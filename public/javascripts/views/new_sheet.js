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
    
    // console.log('creating sheet...');
    // console.log(name);
    // console.log(datasource);
    
    app.project.newSheet(name, datasource);
    
    // TODO: find a more efficient way to check for existing projects.
    // $.ajax({
    //   type: "GET",
    //   url: "/projects/"+app.username+"/"+name,
    //   dataType: "json",
    //   success: function(res) {
    //     if (res.status === 'error') {
    //       
    //     } else {
    //       $('#create_project input[name=new_project_name]').addClass('error');
    //       $('#new_project_name_message').html('This project name is already taken.');
    //     }
    //   },
    //   error: function(err) {
    //     $('#create_project input[name=new_project_name]').addClass('error');
    //     $('#new_project_name_message').html('This project name is already taken.');
    //   }
    // });
      

    return false;
  },
});