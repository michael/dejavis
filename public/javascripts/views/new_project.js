var NewProject = Backbone.View.extend({
  events: {
    'submit #create_project': 'createProject',
  },
  
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
    $(this.el).html(_.tpl('new_project', {}));
    this.loadDataSources();
  },
  
  createProject: function(e) {
    var that = this;
    var name = $('#create_project input[name=new_project_name]').val();
    var title = $('#create_project input[name=new_project_title]').val();
    var datasource = $('#create_project select[name=datasource]').val();
    
    if (new RegExp(graph.get('/type/project').get('properties', 'name').validator).test(name)) {
      
      // TODO: find a more efficient way to check for existing projects.
      $.ajax({
        type: "GET",
        url: "/projects/"+app.username+"/"+name,
        dataType: "json",
        success: function(res) {
          if (res.status === 'error') {
            app.project.newProject(name, title, datasource);
          } else {
            $('#create_project input[name=new_project_name]').addClass('error');
            $('#new_project_name_message').html('This project name is already taken.');
          }
        },
        error: function(err) {
          $('#create_project input[name=new_project_name]').addClass('error');
          $('#new_project_name_message').html('This project name is already taken.');
        }
      });
      
      return false;
    } else {
      $('#create_project input[name=new_project_name]').addClass('error');
      $('#new_project_name_message').html('Invalid project name. No spaces or special characters allowed.');
    }
    return false;
  },
});