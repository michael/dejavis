// Helpers
// --------------

_.tpl = function(tpl, ctx) {
  source = $("script[name="+tpl+"]").html();
  return _.template(source, ctx);
};


// Application
// --------------

var Application = Backbone.View.extend({
  events: {
    'submit #login-form': 'login',
    'click a.load-project': 'loadProject',
    'click a.logout': 'logout',
    'click .tab': 'switchTab',
    'click a.toggle-user-settings': 'toggleUserSettings',
    'click .new-project': 'newProject'
  },
  
  query: function() {
    return this.authenticated ? { "type": "user", "value": this.username }
                              : { "type": "user", "value": "demo" }
  },
  
  initialize: function() {
    var that = this;
    
    // Initialize Project Browser
    this.browser = new Browser({app: this });
    
    // Initialize project
    this.project = new Project({app: this});
    this.header = new Header({el: '#header', app: this});
    
    this.bind('authenticated', function() {
      that.authenticated = true;
      // Re-render browser
      $('.new-project').show();
      that.render();
    });
    
    this.render();
  },
  
  autoAuthenticate: function() {
    // Cookie-based auto-authentication
    if (session.username) {
      graph.merge(session.seed);
      this.authenticated = true;
      this.username = session.username;
      
      $('.new-project').show();
    } else {
      this.authenticated = false;
    }
    this.render();
  },
  
  searchProjects: function(searchstr) {
    app.browser.load({"type": "keyword", "value": encodeURI(searchstr)});
    $('#browser_wrapper').attr('url', '#search/'+encodeURI(searchstr));
    
    app.browser.bind('loaded', function() {
      app.toggleView('browser');
    });
  },
  
  switchTab: function(e) {
    this.toggleView($(e.currentTarget).attr('view'));
  },
  
  newProject: function() {
    this.content = new NewProject({el: '#content_wrapper'});
    this.content.render();
    
    this.toggleView('content');
    return false;
  },
  
  loadProject: function(e) {    
    var user = $(e.currentTarget).attr('user');
        name = $(e.currentTarget).attr('name');
    
    app.project.load(user, name);
    return false;
  },
  
  login: function() {
    this.authenticate();
    return false;
  },
  
  logout: function() {
    var that = this;
    
    $.ajax({
      type: "POST",
      url: "/logout",
      dataType: "json",
      success: function(res) {
        that.username = null;
        that.authenticated = false;
        that.project.close();
        that.browser.loaded = false;
        that.browser.render();
        that.render();
        $('#project_tab').hide();
        // $('#tabs').hide();
        
        app.toggleStartpage();
        
        controller.saveLocation('');
        $('.new-project').hide();
      }
    });
    return false;
  },
  
  switchTab: function(e) {
    this.toggleView($(e.currentTarget).attr('view'));
  },
  
  toggleView: function(view) {
    $('.tab').removeClass('active');
    $('#'+view+'_tab').addClass('active');
    if (view === 'browser' && !this.browser.loaded) return;
    $('.view').hide();
    $('#'+view+'_wrapper').show();
    
    // Wait until url update got injected
    setTimeout(function() {
      controller.saveLocation($('#'+view+'_wrapper').attr('url'));
    }, 200);
    return false;
  },
  
  toggleStartpage: function() {
    app.browser.browserTab.render();
    $('#content_wrapper').html(_.tpl('startpage'));
    app.toggleView('content');
    return false;
  },
  
  toggleUserSettings: function() {
    this.content = new UserSettings({el: '#content_wrapper'});
    this.content.render();
    this.toggleView('content');    
    return false;
  },
  
  authenticate: function() {
    var that = this;
    
    $.ajax({
      type: "POST",
      url: "/login",
      data: {
        username: $('#login-user').val(),
        password: $('#login-password').val()
      },
      dataType: "json",
      success: function(res) {
        if (res.status === 'error') {
          return notifier.notify(Notifications.AUTHENTICATION_FAILED);
        } else {
          graph.merge(res.seed);
          that.username = res.username;
          that.trigger('authenticated');
          
          // Init with foo
          that.project.close();
          that.browser.load({"type": "user", "value": that.username});

          that.browser.bind('loaded', function() {
            that.toggleView('browser');
          });
          controller.saveLocation('#'+that.username);
        }
      },
      error: function(err) {
        notifier.notify(Notifications.AUTHENTICATION_FAILED);
      }
    });
    return false;
  },

  render: function() {
    // Should be rendered just once
    var that = this;
    this.browser.render();
    this.header.render();
    return this;
  }
});

Data.setAdapter('AjaxAdapter');

var remote,                              // Remote handle for server-side methods
    app,                                 // The Application
    controller,                          // Controller responding to routes
    editor,                              // A global instance of the Proper Richtext editor
    graph = new Data.Graph(seed, false); // The database

(function() {
  $(function() {
    function browserSupported() {
      if (head.browser.mozilla && head.browser.version > "1.9.2") {
        return true;
      }
      if (head.browser.webkit && head.browser.version > "533.0") {
        return true;
      }
      return false;
    }
    
    if (!browserSupported()) {
      $('#container').html(_.tpl('browser_not_supported'));
      return;
    }
    
    // Init Application
    // --------------

    var items = new Data.Collection(items_fixture);
    app = new Application({el: '#container', model: items, session: session});
    
    app.render();
        
    // Initialize controller
    controller = new ApplicationController({app: this});
    app.autoAuthenticate();
    
    // Start responding to routes
    Backbone.history.start();
    
    // Prevent exit when there are unsaved changes
    window.onbeforeunload = confirmExit;
    
    function confirmExit() {
      if (graph.dirtyNodes().length>0) return "You have unsynced changes, which will be lost. Are you sure you want to leave this page?";
    }
    
    window.sync = function(callback) {
      $('#sync_state').html('Synchronizing...');
      graph.sync(function(err, invalidNodes) {
        window.pendingSync = false;
        if (!err && invalidNodes.length === 0) {
          $('#sync_state').html('Successfully synced.');
          setTimeout(function() {
            $('#sync_state').html('');
          }, 3000);
          if (callback) callback();
        } else {
          // console.log(err);
          // console.log(invalidNodes.toJSON());
          confirm('There was an error during synchronization. The workspace will be reset for your own safety');
          window.location.reload(true);
        }
      });
    };
    
    window.pendingSync = false;
    graph.bind('dirty', function() {
      if (!window.pendingSync) {
        window.pendingSync = true;
        setTimeout(window.sync, 3000);
      }
    });
    
    graph.bind('conflicted', function() {
      if (!app.document.model) return;
      graph.fetch({
        creator: app.document.model.get('creator')._id,
        name: app.document.model.get('name')
      }, {expand: true}, function(err) {
        app.document.render();
        app.scrollTo('#document_wrapper');
      });
      notifier.notify({
        message: 'There are conflicting nodes. The Document will be reset for your own safety.',
        type: 'error'
      });
    });
  });
})();