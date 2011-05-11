// Sheet
// --------------

// Map property keys to colors
_.propertyColors = function(properties) {
  return d3.scale.ordinal().domain(properties).range(['#8DB5C8', '#90963C', '#B16649', '#A2C355', '#93BAA1', '#808E89', '#86A2A9']);
};

var COLOR_PALETTES = {
  "greenish": ["#737920", "#90963C", "#A2C355"],
  "blueish": ["#808E89", "#5e899d", "#8DB5C8"],
  "redish": ["#974a2c", "#B16649", "#d36538"]
};

// bluegreen 

var colors = new ColorPool(COLOR_PALETTES);


var Sheet = Backbone.View.extend({
  events: {
    'change #group_key': 'addGroupKeyMember',
    'click a.remove-groupkey-member': 'removeGroupKeyMember',
    'click .add-choice': 'addChoice',
    'click .remove-choice': 'removeChoice',
    'click #available_properties .property.select': 'selectProperty',
    'click #available_properties .property.deselect': 'deselectProperty',
    'change select.aggregator': 'switchAggregator',
    
    'change #add_property select': 'addProperty',
    'click a.remove-property': 'removeProperty'
  },
  
  el: '#sheet',
  
  initialize: function(options) {
    // Default properties
    this.groupKey = [];
    this.properties = [];
    this.settings = {};
    this.propertyColors = {};
    
    // Initialize visualization instance
    this.visualization = new Barchart('#canvas', {});
  },
  
  addProperty: function(e) {
    var property = this.collection.properties().get($('#add_property select').val());
    var key = Data.uuid();

    this.properties.push({
      key: key,
      property: property.key,
      name: property.name,
      selected: false,
      aggregator: "SUM"
    });
    
    this.assignColors();
    this.render();
    this.storeSettings();
    return false;
  },
  
  assignColors: function() {
    var that = this;
    colors.reset();
    _.each(this.properties, function(p, index) {
      var property = that.collection.properties().get(p.property);
      that.propertyColors[p.key] = colors.getNext(property.meta.palette);
    });
  },
  
  removeProperty: function(e) {
    var index = $(e.currentTarget).parent().attr('index');
    
    this.properties.splice(index, 1);
    this.assignColors();
    this.compute();
    this.render();
    this.storeSettings();
    
    return false;
  },
  
  switchAggregator: function(e) {
    var propertyIndex = $(e.currentTarget).parent().attr('index'),
        aggregator = $(e.currentTarget).val();
    
    this.properties[propertyIndex].aggregator = aggregator;
    this.compute();
    this.render();
    this.storeSettings();
  },
  
  initSheet: function(callback) {
    var that = this;
    
    // Init filters
    this.filters = new Data.Hash();
    this.properties = [];
    this.groupKey = [];
    
    this.settings = this.model.get('settings') || {};
    
    if (this.settings.properties && this.settings.properties.length > 0 && typeof this.settings.properties[0] == 'object') {
      _.each(this.settings.properties, function(p) {
        if (that.filteredCollection.properties().get(p.property)) {
          that.properties.push(p);
        }
      });
      _.each(this.settings.group_key, function(pkey) {
        if (that.filteredCollection.properties().get(pkey)) {
          that.groupKey.push(pkey);
        }
      });
    }
    
    // Default property set
    if (that.properties.length === 0) {
      this.availableProperties().each(function(p, key) {
        that.properties.push({
          property: key,
          key: Data.uuid(),
          name: p.name,
          selected: false,
          aggregator: "SUM"
        });
      });
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
    
    this.assignColors();
    
    this.filter(function() {
      that.updateFacets();
      callback();
    });
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
            complete: function(c) {
              that.collection = c;
              that.filteredCollection = that.collection;
              
              that.project = that.model;
              that.initSheet(function() {
                that.render();
                that.trigger('loaded');
                if (callback) callback();
              });
            },
            progress: function(progress) {
              $('#data_progress').html("Initializing... "+parseInt(progress*100)+"% complete");
            }
          });
        } else {
          $('#sheet_header').html("<h2>The sheet couldn't be loaded.</h2><p>You may not be permitted to access the datasource.<br/><br/></p>");
        }
      },
      error: function(err) {
        $('#sheet_header').html("The sheet couldn't be loaded.");
      }
    });
  },
  
  addChoice: function(e) {
      var property = $(e.currentTarget).attr('property'),
          operator = $(e.currentTarget).attr('operator'),
          value = $(e.currentTarget).attr('value'),
          that = this;
    
    this.addValue(property, value);
    
    this.filter(function() {
      that.updateFacets();
      that.render();
      that.storeSettings();      
    });
    return false;
  },
  
  removeChoice: function(e) {
    var property = $(e.currentTarget).attr('property'),
        operator = $(e.currentTarget).attr('operator'),
        value = $(e.currentTarget).attr('value'),
        that = this;
    
    this.removeValue(property, value);
    
    this.filter(function() {
      that.updateFacets();
      that.render();
      that.storeSettings();
    });
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
  },
  
  // Update facet objects by removing a particular value
  removeValue: function(property, value) {
    var p = this.collection.properties().get(property);
    var filter = this.filters.get(property);
    
    // Remove value from the filter
    filter.values.del(value);
    filter.objects = filter.objects.difference(p.all('values').get(value).referencedObjects);
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
    
    values = new Data.Hash();
    
    if (!activeItems) {
      values = this.collection.properties().get(property).all('values');
    } else {
      activeItems.each(function(item, key) {
        // All values for a certain property
        item.all(property).each(function(value, key) {
          var val = values.get(key);
          if (val) {
            val.referencedObjects.set(item._id, item);
          } else {
            val = new Data.Node({value: key});
            val.referencedObjects = new Data.Hash().set(item._id, item);
          }
          values.set(key, val);
        });
      });
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
  filter: function(callback) {
    var cspec = {};
    var that = this;
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
      this.compute(); // done twice during initialization?
      callback();
    } else {
      // Filter Collection as fast as possible
      this.filteredCollection = new Data.Collection({properties: this.collection.properties().toJSON(), items: {}, indexes: this.collection.indexes()});
      this.filteredCollection.g.replace('objects', this.filteredCollection.g.all('objects').union(items));
      // Perform value registration manually
      this.filteredCollection.items().each(function(obj) {
        that.filteredCollection.properties().each(function(p, pkey) {
          function registerValues(values) {
            _.each(values, function(v, index) {
              var val;
              val = p.get('values', v);
              if (!val) {
                val = new Data.Node({value: v});
                val.referencedObjects = new Data.Hash();
                // Register value on the property
                p.set('values', v, val);
              }
              val.referencedObjects.set(obj._id, obj);
            });
          }
          registerValues(obj.all(pkey).keys());
        });
      });
      
      this.compute();
      callback();
    }
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
  
  removeGroupKeyMember: function(e) {
    this.groupKey = _.without(this.groupKey, $(e.currentTarget).attr('property'));
    this.compute();
    this.render();
    this.storeSettings();
    return false;
  },
  
  addGroupKeyMember: function() {
    this.groupKey.push($('#group_key').val());
    this.compute();
    this.render();
    this.storeSettings();
    return false;
  },
  
  selectProperty: function(e) {
    if ($(e.target).hasClass('aggregator', 'remove-property')) return;
    
    this.properties[$(e.currentTarget).attr('index')].selected = true;
    this.compute();
    this.render();
    this.storeSettings();
    return false;
  },
  
  deselectProperty: function(e) {
    if ($(e.target).hasClass('aggregator', 'remove-property')) return;
    
    this.properties[$(e.currentTarget).attr('index')].selected = false;
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
      properties[p.key] = {aggregator: Data.Aggregators[p.aggregator], property: p.property};
    });
    
    this.groupedItems = this.filteredCollection.group(this.groupKey, properties);
  },
  
  render: function() {
    var that = this;
    if (this.collection) {
      $(this.el).html(_.tpl('sheet', {
        properties: this.properties,
        available_properties: this.availableProperties(),
        propertyColors: this.propertyColors,
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
        properties.push(p.key);
      });
      
      if ((this.groupedItems && properties.length > 0)) {
        var key = this.groupKey;
        
        this.visualization.update({
          collection: this.groupedItems,
          properties: properties,
          propertyColors: this.propertyColors,
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