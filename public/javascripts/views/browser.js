var Browser = Backbone.View.extend({
  events: {
    
  },
  
  el: '#browser_wrapper',
  
  initialize: function(options) {
    var that = this;
    this.app = options.app;
    // this.browserTab = new BrowserTab({el: '#browser_tab', browser: this});
    // this.documents = [];
  },
  
  // Modfies query state (reflected in the BrowserTab)
  load: function(query) {
    var that = this;
    this.query = query;
    this.graph = new Data.Graph(seed);
    
    $('#browser_tab').show().html('&nbsp;&nbsp;&nbsp;Loading projects...');
    $('#browser_wrapper').html('');
    $.ajax({
      type: "GET",
      // url: "/documents/search/"+query.type+"/"+encodeURI(query.value),
      url: "/projects/search/"+query.type+"/"+encodeURI(query.value),
      dataType: "json",
      success: function(res) {
        that.graph.merge(res.graph);
        // that.facets = new Facets({el: '#facets', browser: that});
        that.loaded = true;
        that.trigger('loaded');
        that.render();
      },
      error: function(err) {}
    });
  },
  
  render: function() {
    var that = this;
    if (this.loaded) {
      this.projects = this.graph.find({"type|=": "/type/project"});
      var DESC_BY_UPDATED_AT = function(item1, item2) {
        var v1 = item1.value.get('updated_at'),
            v2 = item2.value.get('updated_at');
        return v1 === v2 ? 0 : (v1 > v2 ? -1 : 1);
      };
      
      this.projects = this.projects.sort(DESC_BY_UPDATED_AT);
      
      $(this.el).html(_.tpl('browser', {
        projects: this.projects,
        user: that.query.type === 'user' ? that.graph.get('/user/'+that.query.value) : null
      }));
      
      // if (this.loaded) this.facets.render();
      // this.browserTab.render();
    }
    
    // var username = this.options.app.username;
    
    // Render login-state
    // $(this.el).html(_.tpl('header', {
    //   user: graph.get('/user/'+username)
    // }));
  }
});