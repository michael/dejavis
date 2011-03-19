// Helpers
// --------------

_.tpl = function(tpl, ctx) {
  source = $("script[name="+tpl+"]").html();
  return _.template(source, ctx);
};

// Visualization
// --------------

var Visualization = Backbone.View.extend({
  events: {
    'change #group_key': 'updateGroupKey',
    'click .property.add': 'addProperty',
    'click .property.remove': 'removeProperty'    
  },
  
  initialize: function() {
    
    // Default properties
    this.properties = new Data.Hash({
    });
    
    this.groupKey = ["facility"];
        
    // Pregrouping
    this.groupedItems = this.model.group(this.groupKey, this.properties.toJSON());
    
    // Initialize visualizatoin instance
    this.visualization = new Barchart('#canvas', {});
  },
  
  updateGroupKey: function() {
    this.groupKey = [$('#group_key').val()];
    this.compute();
    this.render();
    return false;
  },
  
  addProperty: function(e) {
    this.properties.set($(e.currentTarget).attr('property'), {aggregator: Data.Aggregators.SUM});
    this.compute();
    this.render();
    return false;
  },
  
  removeProperty: function(e) {
    this.properties.del($(e.currentTarget).attr('property'));
    this.compute();
    this.render();
    return false;
  },
  
  availableProperties: function() {
    return this.model.properties().select(function(p) {
      return p.expectedTypes[0] === 'number' && p.unique === true
    });
  },
  
  selectableProperties: function() {
    var that = this;
    return this.availableProperties().select(function(p) {
      return !that.properties.get(p.key);
    });
  },
  
  selectedProperties: function() {
    var that = this;
    return this.availableProperties().select(function(p) {
      return that.properties.get(p.key);
    });
  },
  
  // Extract group keys
  groupKeys: function() {
    return this.model.properties().select(function(p) {
      return p.expectedTypes[0] === 'string' && p.unique
    });
  },
  
  compute: function() {
    this.groupedItems = this.model.group(this.groupKey, this.properties.toJSON());
  },
  
  // Update collection
  update: function(collection) {
    this.model = collection;
    this.compute();
  },
  
  render: function() {
    $(this.el).html(_.tpl('visualization', {
      selectable_properties: this.selectableProperties(),
      selected_properties: this.selectedProperties(),
      properties: this.availableProperties(),
      group_keys: this.groupKeys(),
      group_key: this.groupKey
    }));
    
    // Render visualization
    if (this.groupedItems) {
      this.visualization.update({
        collection: this.groupedItems,
        properties: this.properties.keys(),
        id: this.groupKey
      });
    }
  }
});


// Sheet
// --------------

var Sheet = Backbone.View.extend({
  events: {
    'click .add-choice': 'addChoice',
    'click .remove-choice': 'removeChoice'
  },
  
  initialize: function(options) {
    var that = this;
    this.collection = options.collection;
    this.previousCollection = options.collection;
    this.filteredCollection = options.collection;
    
    // Init visualization view
    this.visualization = new Visualization({el: '#visualization', model: this.filteredCollection});
    
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
  
  addChoice: function(e) {
      var property = $(e.currentTarget).attr('property'),
          operator = $(e.currentTarget).attr('operator'),
          value = $(e.currentTarget).attr('value');
    
    this.addValue(property, value);
    this.updateFacets();
    this.render();
  },
  
  removeChoice: function(e) {
    var property = $(e.currentTarget).attr('property'),
        operator = $(e.currentTarget).attr('operator'),
        value = $(e.currentTarget).attr('value');
    
    this.removeValue(property, value);
    this.updateFacets();
    this.render();
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
    
    this.$('#browser').html(_.tpl('browser', {
      facets: this.facets,
      collection: this.collection,
      filtered_collection: this.filteredCollection
    }));
    
    // Render visualization
    this.visualization.render();
  }
});


// Application
// --------------


var Application = Backbone.View.extend({
  
  initialize: function() {
    // Initialize DataBrowser
    this.sheet = new Sheet({model: this.model, collection: this.model, el: '#sheet'});
  },

  render: function() {
    this.sheet.render();
  }
});

var app;

$(function() {

  // Init Application
  // --------------
  
  var items = new Data.Collection(items_fixture);
  app = new Application({el: '#container', model: items});
  app.render();
});
