var Datasources = Backbone.View.extend({
  events: {
    'submit form#new_datasource': 'createDatasource',
    'submit form#new_permission': 'createPermission',
    'click a.edit-datasource': 'editDatasource',
    'click a.delete-datasource': 'deleteDatasource',
    'click a.delete-permission': 'deletePermission',
    'change .update-permission': 'updatePermission',
    'change .update-datasource': 'updateDatasource'
  },
  
  editDatasource: function(e) {
    this.datasource = graph.get($(e.currentTarget).attr('datasource'));
    this.render();
    return false;
  },
  
  deleteDatasource: function(e) {
    var that = this;
    var datasourceId = $(e.currentTarget).parent().parent().attr('datasource');
    
    if (confirm('Are you sure to delete this datasource?')) {
      graph.fetch({type: "/type/sheet", "datasource": datasourceId}, function(err, sheets) {
        if (sheets.length > 0) {
          alert("This datasource is already used by "+sheets.length+" visualization(s) and can't be deleted.");
        } else {
          graph.del(datasourceId);
          that.datasources.del(datasourceId);
          that.render();
        }
      });
    }
    return false;
  },
  
  deletePermission: function(e) {
    var permissionId = $(e.currentTarget).parent().parent().attr('permission');
    if (confirm('Are you sure to delete this data source permission?')) {
      graph.get(permissionId).get('datasource').permissions.del(permissionId);
      graph.del(permissionId);
      this.render();
    }
    return false;
  },
  
  createDatasource: function() {
    var datasource = graph.set(null, {
      type: "/type/datasource",
      creator: "/user/"+app.username,
      name: $('#new_datasource_name').val(),
      url: $('#new_datasource_url').val()
    });
    datasource.permissions = new Data.Hash();
    this.datasources.set(datasource._id, datasource);
    this.render();
    return false;
  },
  
  updatePermission: function(e) {
    var accessToken = $(e.currentTarget).val();
    var permissionId = $(e.currentTarget).parent().parent().attr('permission');
    graph.get(permissionId).set({
      access_token: accessToken
    });
    return false;
  },
  
  createPermission: function(e) {
    var permission = graph.set(null, {
      type: "/type/datasource_permission",
      user: $('#new_permission_user').val(),
      datasource: this.datasource._id,
      access_token: $('#new_permission_access_token').val()
    });
    
    this.datasource.permissions.set(permission._id, permission);
    this.render();
    return false;
  },
  
  updateDatasource: function(e) {
    var value = $(e.currentTarget).val();
    var property = $(e.currentTarget).attr('name');
    var datasourceId = $(e.currentTarget).parent().parent().attr('datasource');
    attrs = {};
    attrs[property] = value;
    graph.get(datasourceId).set(attrs);
    return false;
  },
  
  load: function() {
    var that = this;
    
    // Fetch ALL users
    graph.fetch({"type": "/type/user"}, function(err, users) {
      graph.fetch({"type": "/type/datasource", "creator": "/user/"+app.username}, function(err, datasources) {
        that.datasources = datasources;
        // For every datasource fetch permissions, in one go of course
        var permission_queries = [];
        that.datasources.each(function(ds) {
          ds.permissions = new Data.Hash();
          permission_queries.push({"type": "/type/datasource_permission", "datasource": ds._id});
        });

        graph.fetch(permission_queries, function(err, permissions) {
          permissions.each(function(p) {
            // Link with corresponding datasource
            that.datasources.get(p.get('datasource')._id).permissions.set(p._id, p);
          });
          // Render when ready
          that.render();
        });
      });
    });
  },
  
  initialize: function() {
    this.load();
  },
  
  render: function() {
    if (this.datasources) {
      $(this.el).html(_.tpl('datasources', {
        // user: graph.get('/user/'+app.username)
        datasources: this.datasources,
        datasource: this.datasource
      }));
      this.delegateEvents();
    } else {
      $(this.el).html("Hang on a second...");
    }
  }
});