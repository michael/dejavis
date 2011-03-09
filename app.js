// Items
// --------------

_.tpl = function(tpl, ctx) {
  source = $("script[name="+tpl+"]").html();
  return _.template(source, ctx);
};


// Application
// --------------

var Application = Backbone.View.extend({
  events: {
    'change #group_key': 'updateGroupKey',
    'click .property.add': 'addProperty',
    'click .property.remove': 'removeProperty'
  },
  
  initialize: function() {
    this.properties = ["support_hardware", "support_click"];
    this.groupKey = ["facility"];
    
    // Pregroouping
    this.groupedItems = this.model.group(this.groupKey);
    
    // Initialize chart instance
    this.chart = new Barchart('#chart', {});
  },
  
  updateGroupKey: function() {
    this.groupKey = [$('#group_key').val()];
    this.groupedItems = this.model.group(this.groupKey);
    this.render();
    return false;
  },
  
  addProperty: function(e) {
    this.properties.push($(e.currentTarget).attr('property'));
    this.render();
    return false;
  },
  
  removeProperty: function(e) {
    this.properties = _.without(this.properties, $(e.currentTarget).attr('property'));
    
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
      return !_.include(that.properties, p.key);
    });
  },
  
  selectedProperties: function() {
    var that = this;
    return this.availableProperties().select(function(p) {
      return _.include(that.properties, p.key);
    });
  },

  render: function() {
    $(this.el).html(_.tpl('application', {
      selectable_properties: this.selectableProperties(),
      selected_properties: this.selectedProperties(),
      properties: this.availableProperties()
    }));
    
    // Render chart
    if (this.groupedItems) {
      this.chart.update({
        collection: this.groupedItems,
        properties: this.properties,
        id: this.groupKey
      });
    }
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
