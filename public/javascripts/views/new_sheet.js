var NewSheet = Backbone.View.extend({
  events: {
    'submit #create_sheet': 'createSheet',
  },
  
  el: '#sheet',
  
  initialize: function() {
    
  },
  
  loadDataSources: function() {
    $.ajax({
      type: "GET",
      url: "/datasources",
      dataType: "json",
      success: function(res) {
        _.each(res.keys, function(k) {
          if (res.status === 'error') return;
          $('#datasource').append('<option value="'+k+'">'+res.graph[k].name+'</option>');
        });
      },
      error: function(err) {}
    });
  },
  
  render: function() {
    $(this.el).html(_.tpl('new_sheet', {}));
    this.loadDataSources();
  },
  
  createSheet: function(e) {
    var that = this;
    var name = $('#create_sheet input[name=new_sheet_name]').val();
    var datasource = $('#create_sheet select[name=datasource]').val();
    app.project.newSheet(name, datasource);
    return false;
  }
});