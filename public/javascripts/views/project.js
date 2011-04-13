// Project
// --------------

var Project = Backbone.View.extend({
  events: {
    'click .add-choice': 'addChoice',
    'click .remove-choice': 'removeChoice',
    'click .new-sheet': 'newSheet',
    'click .sheet': 'switchSheet',
    'click a.delete-project': 'delete',
  },
  
  el: '#project_wrapper',
  
  loadedProjects: {},
  
  initialize: function(options) {
    this.app = options.app;
    _.bindAll(this, "render");
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
  
  initSheet: function() {
    var that = this;
    
    // Init visualization view
    this.visualization = new Visualization({model: this.filteredCollection, project: this});
    
    // Init filters
    this.filters = new Data.Hash();
    this.settings = this.activeSheet.get('settings') || {};
    
    this.collection.properties().each(function(property, key) {
      if (property.meta.facet) {
        
        that.filters.set(key, {
          operator: '|=',
          values: new Data.Hash(),
          objects: new Data.Hash()
        });
        
        // Import values from settings
        if (that.settings && that.settings.filters) {
          _.each(that.settings.filters[key].values, function(val) {
            that.addValue(key, val);
          });
        }
      }
    });
    
    this.filter();
    this.updateFacets();
    

  },
  
  loadSheet: function(sheet) {
    var that = this;
    
    $.ajax({
      type: "GET",
      url: "/data",
      data: {
        sheet: sheet._id
      },
      dataType: "json",
      success: function(res) {
        if (!res.status) {
          that.collection = new Data.Collection(res);
          that.previousCollection = that.collection;
          that.filteredCollection = that.collection;
          that.activeSheet = sheet;
          that.initSheet()
          that.render();
          
          // Make editable
          that.makeEditable();
        } else {
          $('#project_wrapper').html("<div id=\"project\"><div id=\"project_header\"><h2>The sheet couldn't be loaded.</h2><p>You may not be permitted to access the datasource.<br/><br/></p></div></div>");
        }
      },
      error: function(err) {
        $('#project_wrapper').html("The sheet couldn't be loaded.");
      }
    });
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
        that.loadSheet(that.model.get('sheets').first());
        
        // that.trigger('changed');
        // that.loadedProjects[username+"/"+projectname] = id;
        
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
    
    $('#project_wrapper').html("<div id=\"project\"><div id=\"project_header\"><h2>Loading project...</h2><p>Depending on the amount of data this may take a while.<br/><br/></p></div></div>");
    
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
  
  // Close Project
  close: function() {
    this.model = null;
    controller.saveLocation('#'+app.username);
    $('#project_tab').hide();
    app.toggleView('browser');
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
  
  addChoice: function(e) {
      var property = $(e.currentTarget).attr('property'),
          operator = $(e.currentTarget).attr('operator'),
          value = $(e.currentTarget).attr('value');
    
    this.addValue(property, value);
    
    this.filter(property);
    
    this.updateFacets();
    this.render();
    this.storeSettings();
    return false;
  },
  
  removeChoice: function(e) {
    var property = $(e.currentTarget).attr('property'),
        operator = $(e.currentTarget).attr('operator'),
        value = $(e.currentTarget).attr('value');
    
    this.removeValue(property, value);
    
    this.filter(property);
    
    this.updateFacets();
    this.render();
    this.storeSettings();
    return false;
  },
  
  // Extract query from filters
  query: function() {
    var query = {};
    this.filters.each(function(f, key) {
      if (f.values.length > 0) query[key+f.operator] = f.values.values();
    });
    return query;
  },
  
  // Update facet objects based on a new value
  addValue: function(property, value) {
    var p = this.collection.properties().get(property);
    var filter = this.filters.get(property);
    // Add new value to the filter
    filter.values.set(value, value);
    filter.objects = filter.objects.union(p.all('values').get(value).referencedObjects);
    
    // this.filter(property);
  },
  
  // Update facet objects by removing a particular value
  removeValue: function(property, value) {
    var p = this.collection.properties().get(property);
    var filter = this.filters.get(property);
    // Remove value from the filter
    filter.values.del(value);
    filter.objects = filter.objects.difference(p.all('values').get(value).referencedObjects);
    
    // this.filter(property);
  },
  
  // Get values (=facet-choices) for a particular property
  valuesForProperty: function(property) {
    var activeItems,
        values;
    
    this.filters.each(function(filter, key, index) {
      if (key !== property && filter.values.length > 0) {
        if (!activeItems) {
          activeItems = filter.objects;
        } else {
          activeItems = activeItems.intersect(filter.objects);
        }
      }
    });
    
    if (!activeItems) {
      values = this.collection.properties().get(property).all('values');
    } else {
      // Construct a collection and use it for value extraction
      var props = {};
      props[property] = this.collection.properties().get(property).toJSON();
      var c  = new Data.Collection({
        items: activeItems.toJSON(),
        properties: props
      });
      values = c.properties().get(property).all('values')
    }
    
    // Sort values
    var DESC_BY_OBJECT_COUNT = function(item1, item2) {
      var v1 = item1.value.referencedObjects.length,
          v2 = item2.value.referencedObjects.length;
      return v1 === v2 ? 0 : (v1 > v2 ? -1 : 1);
    };
    return values.sort(DESC_BY_OBJECT_COUNT);
  },
  
  // Perform filters on the input collection
  filter: function(activeProperty) {
    var cspec = {};
    
    // TODO: use the smallest first in order to optimize intersection()
    var items;
    
    this.filters.each(function(filter, key, index) {
      if (filter.values.length > 0) {
        if (!items) {
          items = filter.objects;
        } else {
          items = items.intersect(filter.objects);
        }
      }
    });
    
    if (!items) { // no filters at all
      this.filteredCollection = this.collection;
      this.activeFacetCollection = this.collection;
    } else {
      this.filteredCollection = new Data.Collection({
        items: items.toJSON(),
        properties: this.collection.properties().toJSON()
      });
    }
    
    // Update visualization
    this.visualization.update(this.filteredCollection, this.settings.group_key, this.settings.properties);
  },
  
  importSettings: function(settings) {
    
  },
  
  storeSettings: function() {
    var that = this;
    // Settings are only stored for the owner
    if (this.model.get('creator')._id !== "/user/"+app.username) return;
    
    this.settings = {filters: {}, group_key: null, properties: []};
    this.filters.each(function(filter, key) {
      that.settings.filters[key] = {
        operator: "|=",
        values: filter.values.keys()
      }
    });
    
    this.settings.group_key = this.visualization.groupKey;
    this.settings.properties = this.visualization.properties.keys();
    
    this.activeSheet.set({
      settings: that.settings
    });
  },
  
  // Facets and current Facet choices in order to power the view
  updateFacets: function() {
    var facets = new Data.Hash();
    var that = this;
    
    this.collection.properties().each(function(property, key) {
      if (property.meta.facet) {
        var choices = new Data.Hash();
        var selectedChoices = new Data.Hash();
        var p = that.collection.properties().get(key);
        
        that.valuesForProperty(key).each(function(value, valueKey) {
          if (that.filters.get(key) && that.filters.get(key).values.get(valueKey)) {
            selectedChoices.set(valueKey, {_id: valueKey, name: valueKey.slice(0, 26), count: value.referencedObjects.length});
          } else {
            choices.set(valueKey, {_id: valueKey, name: valueKey.slice(0, 26), count: value.referencedObjects.length});
          }
        });
        
        facets.set(key, {
          property: p,
          selected_choices: selectedChoices,
          choices: choices
        });
      }
    });
    this.facets = facets;
  },
  
  render: function() {
    // If sheet loaded
    if (this.activeSheet) {
      $(this.el).html(_.tpl('project', {
        project: this.model,
        facets: this.facets,
        collection: this.collection,
        filtered_collection: this.filteredCollection
      }));
      
      this.renderTab();
      this.visualization.render();
    } else {
      $('#project_tab').html('&nbsp;&nbsp;&nbsp;Loading data...');
    }
    this.delegateEvents();
    return this;
  }
});