//Sentinel 2 Image collection
//Dates
var Start=ee.Date('2019-07-05'); //date before burn
var End=ee.Date('2019-10-05');  //date after burn
var END =End.advance(50,'day');

//Area
var geometry = ee.Geometry.Polygon(
        [[26.99059815747183,38.27096885531639],
 [26.962789014405423,38.261636895183976],
 [26.96484895092886,38.24761769501632],
 [26.945279553956205,38.24006777471134],
 [26.94218964917105,38.21336712677703],
 [26.958325818604642,38.202036618379246],
 [26.98785157544058,38.2120183492158],
 [26.989911511964017,38.193942318311926],
 [27.04827638012808,38.23035958219917],
 [27.070592359131986,38.27349718272393],
 [27.054112866944486,38.3125685123244],
 [27.004674390381986,38.313107280125934],
 [26.99059815747183,38.27096885531639]]);

//NBR Values for Burn Severity Calculation 
var beforevalue=0.174
var aftervalue=-0.045

// Cloud Masking which is used for RGB visualization.
var s1 = ee.Image('COPERNICUS/S2/20160422T084804_20160422T123809_T36TVK');


function maskS2clouds(s1) {
  var qa = s1.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return s1.updateMask(mask).divide(10000);
}

//Image Collection for RGB Visualization
var collection = ee.ImageCollection('COPERNICUS/S2')
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                  .filterDate(Start,End)
                  //.filter(ee.Filter.dayOfYear(FirstDay, LastDay)) 
                  .sort('DATE_ACQUIRED',true)
                  .map(maskS2clouds);
                  
var collection3 = ee.ImageCollection('COPERNICUS/S2')
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                  .filterDate(End,END)
                  //.filter(ee.Filter.dayOfYear(FirstDay, LastDay)) 
                  .sort('DATE_ACQUIRED',true)
                  .map(maskS2clouds);                 

//Image Collection for NBR visualization and calculation
var collection2= ee.ImageCollection('COPERNICUS/S2_SR')
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                  .filterDate(Start,End)                
                  //.filter(ee.Filter.dayOfYear(FirstDay, LastDay)) 
                  .sort('DATE_ACQUIRED',true);

//Image Collection for Heat Change Graphic

var modis = ee.ImageCollection('MODIS/006/MOD11A1');
var dateRange = ee.DateRange(Start,END);
var mod11a2 = modis.filterDate(dateRange);

var modLSTday = mod11a2.select('LST_Day_1km');
var modLSTNight = mod11a2.select('LST_Night_1km');
//Kelvin to C converter
var modLSTc_day = modLSTday.map(function(img) {
  return img
    .multiply(0.02)
    .subtract(273.15)
    .copyProperties(img, ['system:time_start']);
});

var modLSTc_night = modLSTNight.map(function(img) {
  return img
    .multiply(0.02)
    .subtract(273.15)
    .copyProperties(img, ['system:time_start']);
});

//Produce Heat Change Graphics
var temp1 = ui.Chart.image.series({
  imageCollection: modLSTc_day,
  region: geometry,
  reducer: ee.Reducer.mean(),
  scale: 1200,
  xProperty: 'system:time_start'})
  .setOptions({
     title: 'Time Series for Heat During Day Time',
     vAxis: {title: 'Celsius'}});


var temp2 = ui.Chart.image.series({
  imageCollection: modLSTc_night,
  region: geometry,
  reducer: ee.Reducer.mean(),
  scale: 1200,
  xProperty: 'system:time_start'})
  .setOptions({
     title: 'Time Series for Heat During Night Time',
     vAxis: {title: 'Celsius'}});




// Calculating NBR and Using image collection properties which is means it using image collection date and satellite properties.
var NBR = collection2.map(
    function(collection2) {
         return collection2.normalizedDifference(['B8','B11'])
                  .rename('NBR')
                  .copyProperties(collection2, ['system:time_start']); 
    });
// NDVI Calculation    
var NDVI = collection2.map(
    function(collection2) {
         return collection2.normalizedDifference(['B8','B4'])
                  .rename('NDVI')
                  .copyProperties(collection2, ['system:time_start']); 
    });    
 
// Making a NBR and NDVI time series chart.  

var options = {
  title: 'Sentinel-2 Spectral Indexs NBR',
  hAxis: {title: 'Date'},
  vAxis: {title: 'Value'},
  lineWidth: 1,
  series: {
    0: {color: 'FF0000'}, // NBR
}};
var options2 = {
  title: 'Sentinel-2 Spectral Indexs NDVI',
  hAxis: {title: 'Date'},
  vAxis: {title: 'Value'},
  lineWidth: 1,
  series: {
    0: {color: '00FF00'}, // NDVI
}};
print(ui.Chart.image.series(NBR, geometry, ee.Reducer.mean(), 10).setOptions(options));   
print(ui.Chart.image.series(NDVI,geometry,ee.Reducer.mean(),10).setOptions(options2));

print(temp1);
print(temp2);

//Visualization in below map
// Calculating NBR again for selected area
//Nbr layer before burn
var nir = collection.median().select('B8');
var swir = collection.median().select('B11');
var nbr = nir.subtract(swir).divide(nir.add(swir)).rename('nbr');
var clipnbr=nbr.clip(geometry); 
//Nbr layer after burn
var nir3 = collection3.median().select('B8');
var swir3 = collection3.median().select('B11');
var nbr3 = nir3.subtract(swir3).divide(nir3.add(swir3)).rename('nbr3');
var clipnbr3=nbr3.clip(geometry); 


//Visualization in below map this NBR layer.
Map.centerObject(geometry, 15);
var ndviParams = {min:-1, max:1, palette: ['black','white', 'green']};
Map.addLayer(clipnbr, ndviParams, 'NBR image');
Map.addLayer(clipnbr3,ndviParams,'NBR After Image');
// RGB Visualization
var rgbVis = {
  min: 0.0,
  max: 0.3,
  bands: ['B4', 'B3', 'B2'],
};
//RGB layer before burn
var clipdata1=collection.median().clip(geometry); //defining selected geometry to image collection
Map.addLayer(clipdata1, rgbVis , 'RGB Before');
//RGB layer after burn
var clipdata3=collection3.median().clip(geometry);
Map.addLayer(clipdata3, rgbVis, 'RGB Later');

//Unsupervised classification

var bands=['B4','B3','B2'];
var training=clipdata3.sample({
  region:geometry,
  numPixels:101, //Ne olduğunu iyice öğren
  scale:10
});

var grupo= ee.Clusterer.wekaKMeans(3).train(training); //K-Means Method with 3 classes
var classified= clipdata3.cluster(grupo);
Map.addLayer(classified.randomVisualizer(),{}, 'Classified Image');

//Compare Before After for automatic class name detection.

//Before Images

//class 1
//Maskes Layer
var subset_before_1 = collection.median().mask(classified.select("cluster").eq(0));
//Calculating NDVI images with formulas of ndvi: (NIR-RED)/(NIR+RED)
var nir_before_1 = subset_before_1.select('B8');
var red_before_1 = subset_before_1.select('B4');
var ndvi_before_1 = nir_before_1.subtract(red_before_1).divide(nir_before_1.add(red_before_1)).rename('ndvi_before_1');
// This part calculating mean ndvi values as object for each Image.
var c_before_1=ndvi_before_1.reduceRegion({
  reducer:ee.Reducer.mean(),
  geometry:geometry,
  scale:10
});
// This part extracting the number values from an object.
var mean_before_1 = ee.Number(c_before_1.get('ndvi_before_1'));

//class 2

var subset_before_2 = collection.median().mask(classified.select("cluster").eq(1));

var nir_before_2 = subset_before_2.select('B8');
var red_before_2 = subset_before_2.select('B4');
var ndvi_before_2 = nir_before_2.subtract(red_before_2).divide(nir_before_2.add(red_before_2)).rename('ndvi_before_2');

var c_before_2=ndvi_before_2.reduceRegion({
  reducer:ee.Reducer.mean(),
  geometry:geometry,
  scale:10
});

var mean_before_2 = ee.Number(c_before_2.get('ndvi_before_2'));

//class 3


var subset_before_3 = collection.median().mask(classified.select("cluster").eq(2));

var nir_before_3 = subset_before_3.select('B8');
var red_before_3 = subset_before_3.select('B4');
var ndvi_before_3 = nir_before_3.subtract(red_before_3).divide(nir_before_3.add(red_before_3)).rename('ndvi_before_3');

var c_before_3=ndvi_before_3.reduceRegion({
  reducer:ee.Reducer.mean(),
  geometry:geometry,
  scale:10
});

var mean_before_3 = ee.Number(c_before_3.get('ndvi_before_3'));

//After Images
//class 1
//Maskes Class Layer
var subset_after_1 = collection3.median().mask(classified.select("cluster").eq(0));

// Calculating NDVI images with formulas of ndvi: (NIR-RED)/(NIR+RED)
var nir_after_1 = subset_after_1.select('B8');
var red_after_1 = subset_after_1.select('B4');
var ndvi_after_1 = nir_after_1.subtract(red_after_1).divide(nir_after_1.add(red_after_1)).rename('ndvi_after_1');

// This part calculating mean ndvi values as object for each Image
var c_after_1=ndvi_after_1.reduceRegion({
  reducer:ee.Reducer.mean(),
  geometry:geometry,
  scale:10
});
// This part extracting the number values from an object which named
var mean_after_1 = ee.Number(c_after_1.get('ndvi_after_1')).getInfo();

//class 2

var subset_after_2 = collection3.median().mask(classified.select("cluster").eq(1));

var nir_after_2 = subset_after_2.select('B8');
var red_after_2 = subset_after_2.select('B4');
var ndvi_after_2 = nir_after_2.subtract(red_after_2).divide(nir_after_2.add(red_after_2)).rename('ndvi_after_2');

var c_after_2=ndvi_after_2.reduceRegion({
  reducer:ee.Reducer.mean(),
  geometry:geometry,
  scale:10
});

var mean_after_2 = ee.Number(c_after_2.get('ndvi_after_2')).getInfo();

// Class 3
var subset_after_3 = collection3.median().mask(classified.select("cluster").eq(2));

var nir_after_3 = subset_after_3.select('B8');
var red_after_3 = subset_after_3.select('B4');
var ndvi_after_3 = nir_after_3.subtract(red_after_3).divide(nir_after_3.add(red_after_3)).rename('ndvi_after_3');

var c_after_3=ndvi_after_3.reduceRegion({
  reducer:ee.Reducer.mean(),
  geometry:geometry,
  scale:10
});

var mean_after_3 = ee.Number(c_after_3.get('ndvi_after_3')).getInfo();

// Finding the Healthy Vegitation layer after burn.
// Checking Each classes to search which one is healthy one.

//class1
if(mean_after_1 > mean_after_3 && mean_after_1 > mean_after_2){
  var trees=subset_after_1
  var t=1;
}

//class2
if(mean_after_2 > mean_after_3 && mean_after_2 > mean_after_1){
  var trees=subset_after_2
  var t=2;
}

//class2
if(mean_after_3 > mean_after_2 && mean_after_3 > mean_after_1){
  var trees=subset_after_3
  var t=3;
}


// NDVI Differences of classes between before-after burn for each class
var difference_1 = mean_before_1.subtract(mean_after_1).getInfo();
var difference_2 = mean_before_2.subtract(mean_after_2).getInfo();
var difference_3 = mean_before_3.subtract(mean_after_3).getInfo();

// Checking the classes which one has highest ndvi difference for burned area detection.

//initial values which will be change depends on if conditions below here
var usable_before=0;
var usable_after=0;
var subset=0;

// class1
if (difference_1 > difference_2 && difference_1 > difference_3){
  var b=1;
  var subset = classified.select("cluster").eq(0).selfMask();
  var burn_before=subset_before_1;
  var burn_after=subset_after_1;
  Map.addLayer(subset_before_1,rgbVis,'Only Before Burned Area as RGB');
  Map.addLayer(subset_after_1,rgbVis,'Only After Burned Area as RGB');
}

//Condition 2
if (difference_2 > difference_1 && difference_2 > difference_3){
   var b=2;
   var subset = classified.select("cluster").eq(1).selfMask();
   var burn_before=subset_before_2;
   var burn_after=subset_after_2;
   
  Map.addLayer(subset_before_2,rgbVis,'Only Before Burned Area as RGB');
  Map.addLayer(subset_after_2,rgbVis,'Only After Burned Area as RGB');
}

//Condition 3
if (difference_3 > difference_1 && difference_3 > difference_2){
  var b=3;
  var subset = classified.select("cluster").eq(2).selfMask();
  var burn_before=subset_before_3;
  var burn_after=subset_after_3;
  
  Map.addLayer(subset_before_3,rgbVis,'Only Before Burned Area as RGB');
  Map.addLayer(subset_after_3,rgbVis,'Only After Burned Area as RGB');
}

// Finding the soil-dry area class 

if ( b==1 && t==2 || b==2 && t==1 ){
  var soil= subset_after_3;
}

if (b==1 && t==3 || b==3 && t==1){
  var soil= subset_after_2;
}

if (b==2 && t==3 || b==3 && t==2){
  var soil= subset_after_1;
}

//Calculating the amount of pixel for how many hectare burned
var c=subset.reduceRegion({
    reducer:ee.Reducer.count(),
    geometry:geometry,
    scale:10
  });
// extracting the number value from an object.
var realValue=ee.Number(c.get('cluster'));


// Calculating Burned area 
var pixel_area=10*10;
var hectar_m2_ratio=10000;

print('Amount of Burned Area in Unit of Hectare',realValue.multiply(pixel_area/hectar_m2_ratio));

//Calculating Burn severity
var delta=beforevalue-aftervalue;

if (delta>0.66) {print('its high severity burn');
} else if (delta>0.44) {print('its Moderate-high severity burn');
} else if (delta>0.27){print('its moderate-low severity burn');
} else if (delta>0.1){print('its low severity burn');
} else if (delta>-0.1){print('its Unburned');
} else if (delta>-0.25){print('low post fire regrowth');
} else if (delta<-0.25){print('high post fire regrowth');
}

// Making a user interface
var leftMap=ui.Map();
leftMap.drawingTools().setShown(true);
var rightMap=ui.Map();
rightMap.drawingTools().setShown(true);


var beforeimage=ui.Map.Layer(clipdata1, rgbVis ,'RGB Before Burn');
var afterimage=ui.Map.Layer(clipdata3, rgbVis ,'RGB After Burn ');
var beforenbr=ui.Map.Layer(clipnbr, ndviParams, 'NBR Before Burn');
var afternbr=ui.Map.Layer(clipnbr3, ndviParams, 'NBR After Burn');
var interclass=ui.Map.Layer(classified.randomVisualizer(),{}, 'Classified Image After Burn');
var onlyburn_before=ui.Map.Layer(burn_before,rgbVis,"only before burned");
var onlyburn_after=ui.Map.Layer(burn_after,rgbVis,"only after burned");
var only_healthy=ui.Map.Layer(trees, rgbVis ,"Healthy Vegitation after Burn");
var dry_area=ui.Map.Layer(soil, rgbVis ,"Soil-Dry Area After Burn")

var oldMap = ui.root.widgets().get(0);

var before_layer=leftMap.layers();
var after_layer=rightMap.layers();

before_layer.add(beforeimage).add(beforenbr).add(interclass);
after_layer.add(afterimage).add(afternbr).add(onlyburn_before).add(onlyburn_after).add(only_healthy).add(dry_area);


// center map buttons
var button = ui.Button({
  label: 'Get Map Center',
  onClick: function() {
    print(leftMap.centerObject(geometry,13));
  }
});
button.style().set('position','bottom-right');
leftMap.add(button);

var button2 = ui.Button({
  label: 'Get Map Center',
  onClick: function() {
    print(rightMap.centerObject(geometry,13));
  }
});
button2.style().set('position','bottom-right');
rightMap.add(button2);

// export buttons
var button3 = ui.Button({
  label: 'Export to Drive',
  onClick: function() {
    print(Export.image.toDrive({image:clipdata1,description: "RGB Before",folder: "GEE data",region: geometry,scale:10}));
  }
});
button3.style().set('position','bottom-left');
leftMap.add(button3);

var button4 = ui.Button({
  label: 'Export to Drive',
  onClick: function() {
    print(Export.image.toDrive({image:clipdata3,description: "RGB After",folder: "GEE data2",region: geometry,scale:10}));
  }
});
button4.style().set('position','bottom-left');
rightMap.add(button4);

// Back to initial layout buttons
var button5= ui.Button({
  label:'Reset', 
  onClick:function () {
  ui.root.clear();
  ui.root.add(oldMap);
}});
button5.style().set('position','top-left');
leftMap.add(button5);

var button6= ui.Button({
  label:'Reset', 
  onClick:function () {
  ui.root.clear();
  ui.root.add(oldMap);
}});
button6.style().set('position','top-left');
rightMap.add(button6);


var linkPanel=ui.Map.Linker([leftMap],[rightMap]);
leftMap.centerObject(geometry,13);
rightMap.centerObject(geometry,13);


ui.root.widgets().reset([ui.SplitPanel({
  firstPanel:leftMap,
  secondPanel:rightMap,
})]);