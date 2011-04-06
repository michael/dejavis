// Helpers

_.dist = function(a, b) {
  return Math.abs(a - b);
}

var items;

var Barchart = function(el, options) {
  var c;
  var id = options.id;
  var properties;
  var data;
  var x; // x-Scale
  var y; // y-Scale
  var maxx;
  var minx;
  var height,
      width,
      barHeight = 20,
      barOffset = 22,
      itemOffset;
      
  var colors = d3.scale.ordinal().range(['#8DB5C8', '#90963C', '#B16649', '#A2C355', '#93BAA1', '#808E89', '#86A2A9']);
  
  function prepareData() {
    maxx = d3.max(c.items(), function(d) {
      return d3.max(properties, function(p) {
        return d.get(p);
      });
    });
    
    minx = d3.min(c.items(), function(d) {
      return d3.min(properties, function(p) {
        return d.get(p);
      });
    });
    
    x = d3.scale.linear()
        .domain([Math.min(minx, 0), maxx])
        .range([0, 600]);
  }
  
  function renderItems() {    
    // padding = 50;
    itemOffset = barOffset*properties.length+60;
    height = (c.items().length)*itemOffset+50;
    
    // Cleanup
    d3.select(el).selectAll('*').remove();
    
    // Init SVG
    var chart = d3.select(el)
          .append("svg:svg")
          .attr("class", "chart")
          // .attr("width", width)
          .attr("height", height)
          .attr("fill", "#ccc")
            .append("svg:g")
            .attr("class", "plotarea")
            .attr('width', 50)
            .attr("transform", "translate(20, 50)")
    
    // Items
    // --------------
    
    var items = d3.select('g.plotarea')
        .selectAll('g.item')
        .data(c.items())
        .enter().append("svg:g")
          .attr("class", "item")
          .attr("transform", function(d, i) { return "translate(0, "+(i*itemOffset-0.5)+")"; })
        
    // Rulers
    var rules = chart.selectAll("g.rule")
      .data(x.ticks(5))
      .enter().append("svg:g")
        .attr('class', 'rule')
        .attr('transform', function(d) { return 'translate('+ (~~x(d)-0.5) +', 0)' })

    rules.append('svg:line')
      // .attr("y1", -10)
      .attr("y2", -10)
      // .attr("stroke", function(d) { return d !== 0 ? "#fff" : "#666"})
      .attr("stroke", '#666')
      .attr("stroke-width", function(d) { return d !== 0 ? "1" : "1"});

    rules.append('svg:text')
      .attr("class", "label")
      .attr("transform", "translate(0, -20)") // invert flipped coordinate system
      .attr("fill", "#444")
      .attr("text-anchor", "middle")
      .text(function(d) { return d; })


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
    
    // Bars (Container)
    // --------------
    
    var bars = items.selectAll('g').data(function(d) {
              return _.map(properties, function(property) {
                return d.get(property); // the value
              });
            }).enter().append("svg:g")
              .attr("class", "bar")
              .attr("transform", function(d,i) {
                var xx = d < 0 ? x(0) - _.dist(x(d), x(0)) : x(0);
                xx = ~~xx;
                return "translate("+xx+", "+(60+barOffset*i+0.5)+")";
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
      .attr("width", function(d, i) { return Math.max(~~_.dist(x(d), x(0)), 2); })
      .attr("fill", function(d, i) { return colors(i); })
      .attr("opacity", 0.8)
      
    bars.append('svg:text')
      .text(function(d) { return ~~d; })
      .attr("x", function(d, i) { 
        return ~~_.dist(x(d), x(0));
      })
      .attr("transform", "translate(5, 14)")
      .attr("fill" , "#999")

    // Append labels
    // --------------
    
    items.append("svg:text")
        .attr("class", "item-label")
        .attr("transform", "translate("+ ~~x(0) +", 40)")
        .attr("fill", "#444")
        .text(function(d, i) { return d.get(id[0]); });

  }
  
  function render() {
    renderItems();
  }
  
  function update(options) {
    c = options.collection;
    properties = options.properties;
    id = options.id;
    prepareData();
    render();
  }
  
  return {
    render: render,
    update: update
  }
};