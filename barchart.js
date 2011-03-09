var items;

var Barchart = function(el, options) {
  var c;
  var id = options.id;
  var properties;
  var data;
  var y; // y-Scale
  var maxy;
  var miny;
  var x; // x-Scale
  var height,
      width,
      padding;
  
  var colors = d3.scale.ordinal().range(['#8DB5C8', '#808E89', '#B16649', '#90963C', '#A2C355', '#93BAA1', '#86A2A9']);
  
  function prepareData() {
    maxy = d3.max(c.items(), function(d) {
      return d3.max(properties, function(p) {
        return d.get(p);
      });
    });
    
    miny = d3.min(c.items(), function(d) {
      return d3.min(properties, function(p) {
        return d.get(p);
      });
    });
    
    y = d3.scale.linear()
         .domain([miny, maxy])
         .range([0, 250]);
  }
  
  function renderItems() {
    // Calc dimensions
    height = 350;
    width = c.items().length*200;
    padding = 50;
    
    // Cleanup
    d3.select(el).selectAll('*').remove();
    
    // Init SVG
    var chart = d3.select(el)
          .append("svg:svg")
          .attr("class", "chart")
          .attr("width", width)
          .attr("height", height)
          .attr("fill", "#ccc")
            .append("svg:g")
            .attr("class", "plotarea")
            .attr("fill", "#eee")
            .attr('width', 50)
            // Flip coordinate system
            .attr("transform", "translate(60, "+(height-50)+") scale(1, -1)")
    
    // Rulers
    var rules = chart.selectAll("g.rule")
      .data(y.ticks(5))
      .enter().append("svg:g")
        .attr('class', 'rule')
        .attr('transform', function(d) { return 'translate(0, '+ (~~y(d)+0.5) +')' })
    
    rules.append('svg:line')
      .attr("x2", width)
      .attr("stroke", "#ccc");
        
    rules.append('svg:text')
      .attr("class", "label")
      .attr("transform", "scale(1, -1) translate(-20, 1)") // invert flipped coordinate system
      .attr("fill", "#444")
      .attr("text-anchor", "end")
      .text(function(d) { return d; })
        
    
    // Items
    // --------------
    
    var items = d3.select('g.plotarea')
        .selectAll('g.item')
        .data(c.items())
        .enter().append("svg:g")
          .attr("width", 10)
          .attr("height", 60)
          .attr("class", "item")
          .attr("transform", function(d, i) { return "translate("+i*200+", 0)"; })
    
    
    // Bars (Container)
    // --------------
    
    var bars = items.selectAll('g').data(function(d) {
              return _.map(properties, function(property) {
                return d.get(property); // the value
              });
            }).enter().append("svg:g")
              .attr("transform", function(d,i) { return "translate("+20*i+", 0)"; })
    
    // Bars (Rectangle)
    // --------------
      
    bars.append('svg:rect')
      .attr("height", function(d, i) { return y(d); })
      .attr("width", 20)
      .attr("x", function(d, i) { return 20*i; })
      .attr("fill", function(d, i) { return colors(i); })
    
    
    // Append labels
    // --------------
    
    bars = d3.selectAll('g.item')
    
    bars.append("svg:text")
        .attr("class", "label")
        .attr("transform", "scale(1, -1) rotate(0) translate(0, 20) ")
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