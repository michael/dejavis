// Project
// --------------

var Project = Backbone.View.extend({
  events: {
    'click .add-choice': 'addChoice',
    'click .remove-choice': 'removeChoice',
    'click .new-sheet': 'newSheet',
    'click .sheet': 'switchSheet'
    // 'click .property.add': 'addProperty',
  },
  
  el: '#project_wrapper',
  
  loadedProjects: {},
  
  initialize: function(options) {
    this.app = options.app;
    _.bindAll(this, "render");
  },
  
  switchSheet: function() {
    return false;
  },
  
  newSheet: function() {
    alert("We're working on it.");
    return false;
  },
  
  addProperty: function() {
    console.log('oh no');
    return false;
  },
  
  initSheet: function() {
    var that = this;
    
    // Init visualization view
    this.visualization = new Visualization({model: this.filteredCollection});
    
    // Init filters
    this.filters = new Data.Hash();
    this.collection.properties().each(function(property, key) {
      if (property.meta.facet) {
        that.filters.set(key, {
          operator: '|=',
          values: new Data.Hash(),
          objects: new Data.Hash()
        });
      }
    });
    
    this.updateFacets();
  },
  
  loadSheet: function(sheet) {
    var that = this;
    
    $.ajax({
      type: "GET",
      url: "/data",
      data: {
        sheet: sheet._id
      },
      dataType: "json",
      success: function(res) {
        that.collection = new Data.Collection(res);
        that.previousCollection = that.collection;
        that.filteredCollection = that.collection;
        that.initSheet()

        that.activeSheet = sheet;
        that.render();
      },
      error: function(err) {
        $('#document_wrapper').html('Document loading failed');
      }
    });
  },
  
  load: function(username, projectname, mode) {
    var that = this;
    that.mode = mode || (username === app.username ? 'edit' : 'show');
    $('#tabs').show();
    
    function init(id) {
      that.model = graph.get(id);

      if (that.model) {
        that.loadSheet(that.model.get('sheets').first());
        
        // that.trigger('changed');
        that.loadedProjects[username+"/"+projectname] = id;
        
        // Update browser graph reference
        app.browser.graph.set('objects', id, that.model);
        app.toggleView('project');
        that.render();
      } else {
        $('#document_wrapper').html('Document loading failed');
      }
    }
    
    var id = that.loadedProjects[username+"/"+projectname];
    $('#project_tab').show();
    
    // Already loaded - no need to fetch it
    if (id) {
      // TODO: check if there are changes from a realtime session
      init(id);
    } else {
      $('#document_tab').html('&nbsp;&nbsp;&nbsp;Loading...');
      $.ajax({
        type: "GET",
        url: "/projects/"+username+"/"+projectname,
        dataType: "json",
        success: function(res) {
          if (res.status === 'error') {
            $('#document_wrapper').html('Document loading failed');
          } else {
            graph.merge(res.graph);
            init(res.id);
          }
        },
        error: function(err) {
          $('#document_wrapper').html('Document loading failed');
        }
      });
    }
  },
  
  // Close Project
  close: function() {
    
  },
  
  addChoice: function(e) {
      var property = $(e.currentTarget).attr('property'),
          operator = $(e.currentTarget).attr('operator'),
          value = $(e.currentTarget).attr('value');
    
    this.addValue(property, value);
    this.updateFacets();
    this.render();
    return false;
  },
  
  removeChoice: function(e) {
    var property = $(e.currentTarget).attr('property'),
        operator = $(e.currentTarget).attr('operator'),
        value = $(e.currentTarget).attr('value');
    
    this.removeValue(property, value);
    this.updateFacets();
    this.render();
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
    // Add new value to the filter
    filter.values.set(value, value);
    filter.objects = filter.objects.union(p.all('values').get(value).referencedObjects);
    
    this.filter(property);
  },
  
  // Update facet objects by removing a particular value
  removeValue: function(property, value) {
    var p = this.collection.properties().get(property);
    var filter = this.filters.get(property);
    // Remove value from the filter
    filter.values.del(value);
    filter.objects = filter.objects.difference(p.all('values').get(value).referencedObjects);
    
    this.filter(property);
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

    // Update visualization
    this.visualization.update(this.filteredCollection);
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
  
  render: function() {
    // If sheet loaded
    if (this.activeSheet) {
      $(this.el).html(_.tpl('project', {
        project: this.model,
        facets: this.facets,
        collection: this.collection,
        filtered_collection: this.filteredCollection
      }));
      
      this.visualization.render();
    } else {
      $(this.el).html('Loading sheet with data');      
    }
    return this;
  }
});