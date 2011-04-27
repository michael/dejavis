// Sheet
// --------------

// Map property keys to colors
_.propertyColors = function(properties) {
  return d3.scale.ordinal().domain(properties).range(['#8DB5C8', '#90963C', '#B16649', '#A2C355', '#93BAA1', '#808E89', '#86A2A9']);
};

_.format = d3.format(".2f");

var Sheet = Backbone.View.extend({
  events: {
    'change #group_key': 'updateGroupKey',
    'click .add-choice': 'addChoice',
    'click .remove-choice': 'removeChoice',
    'change #group_key': 'updateGroupKey',
    'click .property.select a': 'selectProperty',
    'click .property.deselect a': 'deselectProperty',
    'change select.aggregator': 'switchAggregator'
  },
  
  el: '#sheet',
  
  initialize: function(options) {
    // Default properties
    this.groupKey = [];
    this.properties = [];
    this.settings = {};
    
    // Initialize visualization instance
    this.visualization = new Barchart('#canvas', {});
  },
  
  switchAggregator: function(e) {
    var propertyIndex = $(e.currentTarget).parent().attr('index'),
        aggregator = $(e.currentTarget).val();
    
    this.properties[propertyIndex].aggregator = aggregator;
    this.compute();
    this.render();
    this.storeSettings();
  },
  
  initSheet: function() {
    var that = this;
    
    // Init filters
    this.filters = new Data.Hash();
    this.settings = this.model.get('settings') || {};

    if (this.settings.properties && this.settings.properties.length > 0 && typeof this.settings.properties[0] == 'object') {
      this.properties = this.settings.properties;
      this.groupKey = this.settings.group_key;
    } else {
      that.properties = [];
      // Init properties
      this.availableProperties().each(function(p, key) {
        that.properties.push({
          property: key,
          key: Data.uuid(),
          name: p.name,
          selected: false,
          aggregator: "SUM"
        });
      });
      
      // Default groupKey
      this.groupKey = [this.groupKeys()[0].key];
    }
    
    this.collection.properties().each(function(property, key) {
      if (property.meta.facet) {
        that.filters.set(key, {
          operator: '|=',
          values: new Data.Hash(),
          objects: new Data.Hash()
        });
        
        // Import values from settings
        if (that.settings && that.settings.filters) {
          if (!that.settings.filters[key]) return;
          _.each(that.settings.filters[key].values, function(val) {
            that.addValue(key, val);
          });
        }
      }
    });

    this.filter();
    this.updateFacets();
  },
  
  // Initializes text editors
  initEditors: function() {
    var that = this;
    if (app.project.mode !== 'edit') return;
    
    // Editor for title
    this.$descr = $('#sheet_description').attr('contenteditable', true).unbind();
    
    this.$descr.click(function() {
      editor.activate(that.$descr, {
        placeholder: 'Enter Sheet Description',
        controlsTarget: $('#sheet_editor_controls')
      });

      editor.bind('changed', function() {
        that.model.set({
          descr: editor.content()
        });
      });
    });
    
    // Editor for sheet name
    this.$sheetTab = $('#active_sheet_tab').attr('contenteditable', true).unbind();
    
    this.$sheetTab.click(function() {
      editor.activate(that.$sheetTab, {
        placeholder: 'Enter Sheet Description',
        markup: false,
        multiline: false
      });

      editor.bind('changed', function() {
        that.model.set({
          name: editor.content()
        });
      });
    });
  },
  
  load: function(sheet, callback) {
    var that = this;
    that.collection = that.filteredCollection = null;
    
    that.model = sheet;
    $.ajax({
      type: "GET",
      url: "/data",
      data: {
        sheet: sheet._id
      },
      dataType: "json",
      success: function(res) {
        if (!res.status) {
          DataStreamer.stream(res, {
            chunksize: 200,
            finished: function(c) {
              that.collection = c;
              that.filteredCollection = that.collection;
              that.initSheet();
              that.trigger('loaded');
              if (callback) callback();
              that.project = that.model;
              that.compute();
              that.render();
            },
            progress: function(progress) {
              $('#data_progress').html("Initializing... "+parseInt(progress*100)+"% complete");
            }
          });
        } else {
          $('#sheet').html("<h2>The sheet couldn't be loaded.</h2><p>You may not be permitted to access the datasource.<br/><br/></p>");
        }
      },
      error: function(err) {
        $('#sheet').html("The sheet couldn't be loaded.");
      }
    });
  },
  
  propertyColors: function() {
    return _.propertyColors(this.properties.map(function(p) { return p.property }));
  },
  
  addChoice: function(e) {
      var property = $(e.currentTarget).attr('property'),
          operator = $(e.currentTarget).attr('operator'),
          value = $(e.currentTarget).attr('value');
    
    this.addValue(property, value);
    this.filter(property);
    this.updateFacets();
    this.render();
    this.storeSettings();
    return false;
  },
  
  removeChoice: function(e) {
    var property = $(e.currentTarget).attr('property'),
        operator = $(e.currentTarget).attr('operator'),
        value = $(e.currentTarget).attr('value');
    
    this.removeValue(property, value);
    
    this.filter(property);
    this.updateFacets();
    this.render();
    this.storeSettings();
    return false;
  },
  
  // Extract query from filters
  query: function() {
    var query = {};
    this.filters.each(function(f, key) {
      if (f.values.length > 0) query[key+f.operator] = f.values.values();
    });
    return query;
  },
  
  // Update facet objects based on a new value
  addValue: function(property, value) {
    var p = this.collection.properties().get(property);
    var filter = this.filters.get(property);
    
    // Skip values that do not exist in the current dataset
    if (!p.all('values').get(value)) return;
    // Add new value to the filter
    filter.values.set(value, value);
    filter.objects = filter.objects.union(p.all('values').get(value).referencedObjects);
    
    // this.filter(property);
  },
  
  // Update facet objects by removing a particular value
  removeValue: function(property, value) {
    var p = this.collection.properties().get(property);
    var filter = this.filters.get(property);
    
    // Remove value from the filter
    filter.values.del(value);
    filter.objects = filter.objects.difference(p.all('values').get(value).referencedObjects);
    
    // this.filter(property);
  },
  
  // Get values (=facet-choices) for a particular property
  valuesForProperty: function(property) {
    var activeItems,
        values;
    
    this.filters.each(function(filter, key, index) {
      if (key !== property && filter.values.length > 0) {
        if (!activeItems) {
          activeItems = filter.objects;
        } else {
          activeItems = activeItems.intersect(filter.objects);
        }
      }
    });
    
    if (!activeItems) {
      values = this.collection.properties().get(property).all('values');
    } else {
      // Construct a collection and use it for value extraction
      var props = {};
      props[property] = this.collection.properties().get(property).toJSON();
      var c  = new Data.Collection({
        items: activeItems.toJSON(),
        properties: props
      });
      values = c.properties().get(property).all('values')
    }
    
    // Sort values
    var DESC_BY_OBJECT_COUNT = function(item1, item2) {
      var v1 = item1.value.referencedObjects.length,
          v2 = item2.value.referencedObjects.length;
      return v1 === v2 ? 0 : (v1 > v2 ? -1 : 1);
    };
    return values.sort(DESC_BY_OBJECT_COUNT);
  },
  
  // Perform filters on the input collection
  filter: function(activeProperty) {
    var cspec = {};
    
    // TODO: use the smallest first in order to optimize intersection()
    var items;
    
    this.filters.each(function(filter, key, index) {
      if (filter.values.length > 0) {
        if (!items) {
          items = filter.objects;
        } else {
          items = items.intersect(filter.objects);
        }
      }
    });
    
    if (!items) { // no filters at all
      this.filteredCollection = this.collection;
      this.activeFacetCollection = this.collection;
    } else {
      this.filteredCollection = new Data.Collection({
        items: items.toJSON(),
        properties: this.collection.properties().toJSON()
      });
    }
    
    this.compute();
  },
  
  storeSettings: function() {
    var that = this;
    
    // Settings are only stored for the owner
    if (app.project.model.get('creator')._id !== "/user/"+app.username) return;
    
    this.settings = {filters: {}, group_key: null, properties: []};
    this.filters.each(function(filter, key) {
      that.settings.filters[key] = {
        operator: "|=",
        values: filter.values.keys()
      }
    });
    
    this.settings.group_key = this.groupKey;
    this.settings.properties = this.properties;
    
    this.model.set({
      settings: that.settings
    });
  },
  
  // Facets and current Facet choices in order to power the view
  updateFacets: function() {
    var facets = new Data.Hash();
    var that = this;
    
    this.collection.properties().each(function(property, key) {
      if (property.meta.facet) {
        var choices = new Data.Hash();
        var selectedChoices = new Data.Hash();
        var p = that.collection.properties().get(key);
        
        that.valuesForProperty(key).each(function(value, valueKey) {
          if (that.filters.get(key) && that.filters.get(key).values.get(valueKey)) {
            selectedChoices.set(valueKey, {_id: valueKey, name: valueKey.slice(0, 26), count: value.referencedObjects.length});
          } else {
            choices.set(valueKey, {_id: valueKey, name: valueKey.slice(0, 26), count: value.referencedObjects.length});
          }
        });
        
        facets.set(key, {
          property: p,
          selected_choices: selectedChoices,
          choices: choices
        });
      }
    });
    this.facets = facets;
  },
  
  updateGroupKey: function() {
    this.groupKey = [$('#group_key').val()];
    this.compute();
    this.render();
    this.storeSettings();
    return false;
  },
  
  selectProperty: function(e) {
    this.properties[$(e.currentTarget).parent().attr('index')].selected = true;
    this.compute();
    this.render();
    this.storeSettings();
    return false;
  },
  
  deselectProperty: function(e) {
    this.properties[$(e.currentTarget).parent().attr('index')].selected = false;
    this.compute();
    this.render();
    this.storeSettings();
    return false;
  },
  
  availableProperties: function() {
    return this.collection.properties().select(function(p) {
      return p.expectedTypes[0] === 'number' && p.unique === true
    });
  },
  
  // Extract group keys
  groupKeys: function() {
    return this.filteredCollection.properties().select(function(p) {
      return p.expectedTypes[0] === 'string'
    });
  },
  
  compute: function() {
    var properties = {};
    
    _.each(this.properties, function(p, index) {
      if (!p.selected) return;
      properties[p.property] = {aggregator: Data.Aggregators[p.aggregator]};
    });
    
    if (this.groupKey.length > 0) {
      this.groupedItems = this.filteredCollection.group(this.groupKey, properties);
    } else {
      this.groupedItems = this.filteredCollection;
    }
  },
  
  render: function() {
    if (this.collection) {
      $(this.el).html(_.tpl('sheet', {
        properties: this.properties,
        propertyColors: this.propertyColors(),
        group_keys: this.groupKeys(),
        group_key: this.groupKey,
        facets: this.facets,
        sheet: this.model,
        collection: this.collection,
        grouped_items: this.groupedItems,
        filtered_collection: this.filteredCollection
      }));
      
      // Prepare properties to work with the visualization
      var properties = [];
      _.each(this.properties, function(p, index) {
        if (!p.selected) return;
        properties.push(p.property);
      });
      
      if ((this.groupedItems && properties.length > 0)) {
        this.visualization.update({
          collection: this.groupedItems,
          properties: properties,
          propertyColors: this.propertyColors(),
          id: this.groupKey
        });
      } else {
        this.$('#canvas').html('<div class="info"><h2>Please choose some properties on the right tab.</h2></div>');
      }
      this.initEditors();
    }
    
    this.delegateEvents();
    return this;
  }
});