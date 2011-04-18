var Project = Backbone.View.extend({
  el: '#project_wrapper',
  events: {
    'click .new-sheet': 'toggleNewSheet',
    'click .sheet a.switch-sheet': 'switchSheet',
    'click a.delete-project': 'deleteProject',
    'click a.delete-sheet': 'deleteSheet',
    'click a.publish-project': 'publishProject',
    'click a.unpublish-project': 'unpublishProject',
  },
  
  // Event handlers
  // --------------
  
  switchSheet: function(e) {
    var sheetId = $(e.currentTarget).parent().attr('sheet');
    var sheet = graph.get(sheetId);
    this.activeSheet = sheet;
    this.sheet.collection = null;
    this.render();
    controller.saveLocation('#'+this.model.get('creator')._id.split('/')[2]+'/'+this.model.get('name')+'/'+(this.model.get('sheets').index(sheetId)+1));
    this.sheet.load(sheet);
    return false;
  },
  
  publishProject: function() {
    this.model.set({
      published_on: new Date()
    });
    this.render();
    return false;
  },
  
  unpublishProject: function() {
    this.model.set({
      published_on: null
    });
    this.render();
    return false;
  },
  
  toggleNewSheet: function() {    
    var newSheet = new NewSheet();
    newSheet.render();
    return false;
  },
  
  deleteProject: function() {
    var that = this;
    var id = this.model._id;
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
  
  deleteSheet: function(e) {
    var sheetId = $(e.currentTarget).parent().attr('sheet');
    this.model.set({
      sheets: _.without(this.model.get('sheets').keys(), sheetId)
    });
    this.render();
    return false;
  },
  
  loadedProjects: {},
  
  initialize: function(options) {
    this.app = options.app;
    _.bindAll(this, "render");
    this.sheet = new Sheet({project: this});
  },
  
  // Data operations
  // --------------
  
  newProject: function(name, title, datasourceId) {
    var that = this;
    function emptyProject() {
      
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
    
    // disable auto-sync for the moment
    window.pendingSync = true;
    this.model = emptyProject();

    window.sync(function() {
      that.load(app.username, name, 1);
      // Update browser graph
      if (app.browser && app.browser.query && app.browser.query.type === "user" && app.browser.query.value === app.username) {
        app.browser.graph.set('objects', that.model._id, that.model);
        app.browser.render();
      }
    });
  },
  
  // Create a new sheet for the current project and load it
  newSheet: function(name, datasourceId) {
    
    var that = this;
    function createSheet() {
      var sheet = graph.set(null, {
        type: "/type/sheet",
        name: name,
        project: that.model._id,
        datasource: datasourceId
      });
      
      var sheets = that.model.get('sheets').keys();
      sheets.push(sheet._id);

      that.model.set({
        sheets: sheets
      });
      return sheet;
    }
    
    // disable auto-sync for the moment
    window.pendingSync = true;
    var sheet = createSheet();
    
    that.activeSheet = sheet;
    that.sheet.collection = null;
    that.render();
    
    window.sync(function() {
      that.sheet.load(sheet);
    });
  },
  
  makeEditable: function() {
    var that = this;
    if (this.mode !== 'edit') return;
    
    // Editor for title
    this.$node = $('#project_title').attr('contenteditable', true).unbind();
    
    this.$node.click(function() {
      editor.activate(that.$node, {
        placeholder: 'Enter Project Title',
        multiline: false,
        markup: false
      });

      editor.bind('changed', function() {
        that.model.set({
          title: editor.content()
        });
      });
    });

  },
  
  load: function(username, projectname, sheetNr) {
    var that = this;
    
    that.mode = username === app.username ? 'edit' : 'show';
    
    $('#tabs').show();
    
    function init(id) {
      that.model = graph.get(id);

      if (that.model) {
        // Load first sheet by default
        that.activeSheet = that.model.get('sheets').at(sheetNr-1);
        that.sheet.load(that.activeSheet);

        // Update browser graph reference
        app.browser.graph.set('objects', id, that.model);
        app.toggleView('project');
        that.render();
        
        if (controller) {
          controller.saveLocation('#'+username+'/'+projectname+'/'+sheetNr);
          $('#project_wrapper').attr('url', '#'+username+'/'+projectname+'/'+sheetNr);
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
      activeSheet: this.activeSheet
    }));
    
    this.renderTab();
    this.sheet.render();
    this.delegateEvents();
    this.makeEditable();
    return this;
  }
});