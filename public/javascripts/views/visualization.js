// Visualization
// --------------

var Visualization = Backbone.View.extend({
  events: {
    'change #group_key': 'updateGroupKey',
    'click .property.add': 'addProperty',
    'click .property.remove': 'removeProperty'    
  },
  el: '#visualization',
  
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
    console.log('removeproperty');
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
    
    this.delegateEvents();
    return this;
  }
});