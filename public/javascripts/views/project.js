// Project
// --------------

var Project = Backbone.View.extend({
  events: {
    'click .new-sheet': 'newSheet',
    'click .sheet': 'switchSheet',
    'click a.delete-project': 'delete',
  },
  
  el: '#project_wrapper',
  
  loadedProjects: {},
  
  initialize: function(options) {
    this.app = options.app;
    _.bindAll(this, "render");
    
    this.sheet = new Sheet({project: this});
  },
  
  switchSheet: function() {
    return false;
  },
  
  newSheet: function() {
    alert("Not available yet. We're working on it.");
    return false;
  },
  
  delete: function() {
    var that = this;
    var id = this.model._id
    if (confirm('Are you sure to delete this project?')) {
      graph.del(id);
      app.browser.graph.del(id);
      app.browser.render();
      setTimeout(function() {
        app.toggleView('browser');
      }, 300);
      notifier.notify(Notifications.DOCUMENT_DELETED);
      this.close();
    }
    return false;
  },
  
  makeEditable: function() {
    var that = this;
    if (this.mode !== 'edit') return;
    
    // Editor for title
    this.$node = $('#project_title').attr('contenteditable', true).unbind();
    
    editor.activate(this.$node, {
      placeholder: 'Enter Project Title',
      multiline: false,
      markup: false
    });
    
    editor.bind('changed', function() {
      that.model.set({
        title: editor.content()
      });
    });
  },
  
  load: function(username, projectname, mode) {
    var that = this;
    
    this.activeSheet = null;
    that.mode = mode || (username === app.username ? 'edit' : 'show');
    $('#tabs').show();
    
    function init(id) {
      that.model = graph.get(id);

      if (that.model) {
        // Load first sheet by default
        that.sheet.load(that.model.get('sheets').first());
        
        that.sheet.bind('loaded', function() {
          that.activeSheet = that.sheet.model;
        });
        
        // Update browser graph reference
        app.browser.graph.set('objects', id, that.model);
        app.toggleView('project');
        that.render();
        
        if (controller) {
          controller.saveLocation('#'+username+'/'+projectname);
          $('#project_wrapper').attr('url', '#'+username+'/'+projectname);
        }
      } else {
        $('#project_wrapper').html('Project loading failed');
      }
    }
    
    $('#project_tab').show();
    $('#project_tab').html('&nbsp;&nbsp;&nbsp;Loading...');
    
    $.ajax({
      type: "GET",
      url: "/projects/"+username+"/"+projectname,
      dataType: "json",
      success: function(res) {
        if (res.status === 'error') {
          $('#project_wrapper').html('Document loading failed');
        } else {
          graph.merge(res.graph);
          init(res.id);
        }
      },
      error: function(err) {
        $('#project_wrapper').html('Project loading failed');
      }
    });
  },
  
  new: function(name, title, datasourceId) {
    var that = this;
    function emptyProject() {
      // disable auto-sync for the moment
      window.pendingSync = true;
      var project = graph.set(Data.uuid('/project/'+ app.username +'/'), {
        type: "/type/project",
        creator: "/user/"+app.username,
        created_at: new Date(),
        updated_at: new Date(),
        name: name,
        sheets: [],
        title: title
      });
      var sheet = graph.set(null, {
        type: "/type/sheet",
        name: "Sheet 1",
        project: project._id,
        datasource: datasourceId
      });
      project.set({
        sheets: [sheet._id]
      });
      return project;
    }
    
    this.model = emptyProject();

    window.sync(function() {
      that.load(app.username, name);
      // Update browser graph
      if (app.browser && app.browser.query && app.browser.query.type === "user" && app.browser.query.value === app.username) {
        app.browser.graph.set('objects', that.model._id, that.model);
        app.browser.render();
      }
    });
  },
  
  renderTab: function() {
    if (this.model) {
      $('#project_tab').show();
      $('#project_tab').html(_.tpl('project_tab', {
        username: this.model.get('creator')._id.split('/')[2],
        project_name: this.model.get('name')
      }));
    }
  },
  
  // Close Project
  close: function() {
    this.model = null;
    controller.saveLocation('#'+app.username);
    $('#project_tab').hide();
    app.toggleView('browser');
  },

  render: function() {
    $(this.el).html(_.tpl('project', {
      project: this.model,
    }));
    
    this.renderTab();
    this.sheet.render();
    
    this.delegateEvents();
    return this;
  }
});