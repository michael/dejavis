// Helpers

_.dist = function(a, b) {
  return Math.abs(a - b);
}

var items;

// Takes a Data.Hash of Data.Objects and a numeric property
_.min = function(items, property) {
  var result = Infinity;
  items.each(function(item, key, index) {
    var value = item.get(property);
    if (_.isNumber(value) && value < result) result = value;
  });
  return result;
}

_.max = function(items, property) {
  var result = -Infinity;
  items.each(function(item, key, index) {
    var value = item.get(property);
    if (_.isNumber(value) && value > result) result = value;
  });
  return result;
}

var Barchart = function(el, options) {
  var c;
  var id = options.id;
  var properties;
  var propertyColors;
  var data;
  var max, min;
  var units = {};
  var height,
      nullPos = 0,
      width,
      barHeight = 20,
      barOffset = 22,
      plotWidth = 600,
      itemOffset;

  function scale(p, value) {
    var unit = p.meta && p.meta.unit ? p.meta.unit : "default";
    return units[unit].scale(value);
  }
  
  function prepareData() {
    max = -Infinity;
    _.each(properties, function(p, index) {
      max = _.max(c.items(), p);
    });
    
    min = Infinity;
    _.each(properties, function(p, index) {
      min = _.min(c.items(), p);
    });
    
    var fullScale = d3.scale.linear()
        .domain([Math.min(min, 0), Math.max(max, 0)])
        .range([0, 600]);
        
    nullPos = fullScale(0);
    
    // Reset units hash
    units = {};
    
    // Build unit groups
    _.each(properties, function(pkey) {
      var p = c.properties().get(pkey);
      var unit = p.meta && p.meta.unit ? p.meta.unit : "default";
      
      if (units[unit]) {
        units[unit].min = Math.min(units[unit].min, _.min(c.items(), pkey));
        units[unit].max = Math.max(units[unit].max, _.max(c.items(), pkey));
      } else {
        units[unit] = {
          min: _.min(c.items(), pkey),
          max: _.max(c.items(), pkey)
        }
      }
    });
    
    // Build scales for units
    _.each(units, function(unit, key) {
      if (!(Math.abs(unit.min - unit.max) > 0)) {
        unit.max = unit.min + 1;
      }
      function candidate() {
        return d3.scale.linear()
            .domain([unit.min, 0]) // keep 0 for domain max?
            .range([0, nullPos]);
      }
      function alternative() {
        return d3.scale.linear()
            .domain([0, unit.max])
            .range([nullPos, 600]);
      }
      
      var s;
      if (unit.min<0) {
        s = candidate();
        if (s(unit.max) > 600) {
          s = alternative();
        }
      } else {
        s = alternative();
      }
      unit.scale = s;
    });
  }
  
  function renderItems() {    
    // padding = 50;
    // itemOffset = barOffset*properties.length+60;
    // height = (c.items().length)*itemOffset+50;
    
    // Cleanup
    d3.select(el).selectAll('*').remove();
    
    // Init SVG
    var chart = d3.select(el)
          .append("div")
          .attr("class", "chart barchart")
          
          // .attr("width", width)
          // .attr("height", height)
          // .attr("fill", "#ccc")
            // .append("svg:g")
            // .attr("class", "plotarea")
            // .attr('width', 50)
            // .attr("transform", "translate(20, 0)")
    
    // Items
    // --------------
    
    // Sort items by group key
    var ASC_BY_KEY = function(item1, item2) {
      var v1 = item1.key,
          v2 = item2.key;
      return v1 === v2 ? 0 : (v1 < v2 ? -1 : 1);
    };
    
    var dataitems = new Data.Hash();
    c.items().sort(ASC_BY_KEY).each(function(item, key, index) {
      dataitems.set(key, item);
    });
    
    var items = d3.select('div.chart')
        .selectAll('div.item')
        .data(dataitems)
        .enter().append("div")
          .attr("class", "item")
          // .attr("transform", function(d, i) { return "translate(0, "+(i*itemOffset-0.5)+")"; })
    
    
    // Append labels
    // --------------

    var prevGroupNames = _.map(id, function() { return ""; });
    
    var groupNames = items.selectAll('div.label').data(function(d) {
              var groupNames = [];
              
              _.each(id, function(property) {
                var part = d.get(property);
                groupNames.push(part.values ? part.values().join(", ") : part);
              });
              
              var res = [];
              _.each(groupNames, function(name, index) {
                if (name !== prevGroupNames[index]) {
                  res.push(name);
                } else {
                  res.push("")
                }
              });
              prevGroupNames = groupNames;
              return res;
            }).enter().append("div")
              .attr("class", function(d, i) {
                return "label level-"+(Math.min(prevGroupNames.length -i, 3));
              })
              .attr("style", function(d) { return d=="" ? "display: none;" : ""})
              .html(function(d, i) { return d; })
    
    // Bars (Container)
    // --------------

    var barsContainers = items.append('svg:svg')
      .attr('height', barOffset*properties.length)
      .append('svg:g')
        .attr('class', 'bars');
        
    var bars = barsContainers.selectAll('g.bar').data(function(d) {
              return _.map(properties, function(property) {
                return {
                  value: d.get(property),
                  property: c.properties().get(property)
                }; // the value
              });
            }).enter().append("svg:g")
              .attr("class", "bar")
              .attr("transform", function(d,i) {
                var xOffset = d.value < 0 ? scale(d.property, 0) - _.dist(scale(d.property, d.value), scale(d.property, 0)) : scale(d.property, 0);
                xOffset = ~~xOffset;
                return "translate("+xOffset+", "+(barOffset*i+0.5)+")";
              });
    
    bars.on("mouseover", function(d) {
      d3.select(this).selectAll('text')
        .attr('fill', '#444');
      d3.select(this).selectAll('rect')
        .attr('opacity', 1.0);  
    }).on("mouseout", function(d) {
      d3.select(this).selectAll('text')
        .attr('fill', '#999');
      d3.select(this).selectAll('rect')
        .attr('opacity', 0.8);
    });


    // Bars (Rectangle)
    // --------------

    bars.append('svg:rect')
      .attr("height", barHeight)
      .attr("width", function(d, i) {
        return Math.max(~~_.dist(scale(d.property, d.value), scale(d.property, 0)), 2); 
      })
      .attr("fill", function(d, i) { return propertyColors(properties[i]); })
      .attr("opacity", 0.8)
      
    bars.append('svg:text')
      .text(function(d) {
        var str = _.format(d.value, 2);
        if (d.property.meta && d.property.meta.unit) str += " "+d.property.meta.unit;
        return str;
      })
      .attr("x", function(d, i) {
        return ~~_.dist(scale(d.property, d.value), scale(d.property, 0));
      })
      .attr("transform", "translate(5, 14)")
      .attr("fill" , "#999")
    
        
    
    // Rulers
    // var rules = chart.selectAll("g.rule")
    //   .data(x.ticks(5))
    //   .enter().append("svg:g")
    //     .attr('class', 'rule')
    //     .attr('transform', function(d) { return 'translate('+ (~~x(d)-0.5) +', 0)' })
    // 
    // rules.append('svg:line')
    //   // .attr("y1", -10)
    //   .attr("y2", -10)
    //   // .attr("stroke", function(d) { return d !== 0 ? "#fff" : "#666"})
    //   .attr("stroke", '#666')
    //   .attr("stroke-width", function(d) { return d !== 0 ? "1" : "1"});
    // 
    // rules.append('svg:text')
    //   .attr("class", "label")
    //   .attr("transform", "translate(0, -20)") // invert flipped coordinate system
    //   .attr("fill", "#444")
    //   .attr("text-anchor", "middle")
    //   .text(function(d) { return d; })


    // Item separator
    // var itemRules = items.append("svg:line")
    //     .attr("x2", 400)
    //     .attr("stroke", "#ccc")
    //     .attr('transform', function(d) { return 'translate('+ (~~x(d)+0.5) +', 0)' })

    // Zero line
    // chart.append('svg:line')
    //   .attr("x1", ~~x(0)-0.5)
    //   .attr("x2", ~~x(0)-0.5)
    //   // .attr("y", 100)
    //   .attr("y2", height)
    //   .attr("stroke", '#888')
    




      
  }
  
  function render() {
    renderItems();
  }
  
  function update(options) {
    c = options.collection;
    properties = options.properties;
    propertyColors = options.propertyColors;
    id = options.id;
    prepareData();
    render();
  }
  
  return {
    render: render,
    update: update
  }
};