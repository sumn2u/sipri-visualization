declare var topojson: any;
import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';
import {legendColor, legendHelpers} from 'd3-svg-legend';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})


export class AppComponent implements OnInit {
  play = false;
  refresh = false;
  progress = false;

  dateRange = [];
  titleTag;
  divname;

  autoTicks = true;
  disabled = false;
  invert = false;
  showTicks = true;
  step = 20;
  thumbLabel = true;
  vertical = false;
  tickInterval = 1;
  tivImportURL = 'https://raw.githubusercontent.com/sumn2u/sipri-visualization/main/data/TIV-Import-All-Country-1950-2022-Refined.csv';
  tivExportURL = 'https://raw.githubusercontent.com/sumn2u/sipri-visualization/main/data/TIV-Export-All-Country-1950-2022-Refined.csv';
  polylinesURL = 'https://raw.githubusercontent.com/GDS-ODSSS/unhcr-dataviz-platform/master/data/geospatial/world_lines_simplified.json';
  polygonsURL = 'https://raw.githubusercontent.com/GDS-ODSSS/unhcr-dataviz-platform/master/data/geospatial/world_polygons_simplified.json';
  armsExportURL = 'https://raw.githubusercontent.com/sumn2u/sipri-visualization/main/data/TIV-Export-All-1950-2022-Refined.csv';
  regionalExpensesURL = 'https://raw.githubusercontent.com/sumn2u/sipri-visualization/main/data/regional_data.csv';
  tivImports = [];
  tivExports = [];
  tivInfos = [];
  topology = [];
  polylines = [];
  yearRange = [];
  regionalExpenses = [];
  sliderDate;
  drawCallout;
  currentYear;

  topTenExports = [];
  scenarioImport = true;
  tivImportsGroups = [];
  scenarioExport = false;
  scenario = 'Imports';
  svgWidth;
  xMargin;
  graphShift;
  lowerBoundYear;
  upperBoundYear;
  ngOnInit() {
    let width = window.innerWidth;
    const windowWidth = width;

    if (windowWidth <= 500) {
      this.svgWidth = 375;
      this.xMargin = 50;
      this.graphShift = 50;
    } else {
      this.svgWidth = 400;
      this.xMargin = 30;
      this.graphShift = 40;
    }

    if (width > 500) {
      width = 500;
    }

    // load data
    const promises = [
      d3.json(this.polygonsURL),
      d3.json(this.polylinesURL),
      d3.csv(this.tivImportURL),
      d3.csv(this.tivExportURL),
      d3.csv(this.armsExportURL),
      d3.csv(this.regionalExpensesURL)
    ];

    Promise.all(promises)
    .then(([topology, polylines,  tivImports, tivExports, armsExports, regionalExpenses]) => {
      this.tivImports = this.humanizeImportExportData(tivImports);
      this.tivExports = this.humanizeImportExportData(tivExports);

      this.tivInfos = this.humanizeArmsExportData(armsExports);
      this.topology = topology;
      this.polylines = polylines;
      const [firstTivImportElement, lastTivImportElement] = [this.tivImports[0], this.tivImports[this.tivImports.length - 1]];
      this.upperBoundYear =  lastTivImportElement?.year;
      this.lowerBoundYear =  firstTivImportElement?.year;
      this.regionalExpenses = this.humanizeRegionalExpensesData(regionalExpenses, this.upperBoundYear);
      this.yearRange =  this.tivImports.map(tivImport => tivImport.year);
      this.tivImportsGroups = this.groupTIVImports(this.tivExports, this.upperBoundYear);
      this.setMap(1000, 600, this.topology, this.polylines, firstTivImportElement);
      this.topTenExports = this.getTopTenExports(this.tivExports, this.upperBoundYear );
      this.showTIVInfo(1000, 400, this.tivInfos);
      this.showRegionalExpenses(1000, 300, this.regionalExpenses);
      this.showTopExporter(1000, 400, this.topTenExports);
      this.showTIVImportsGroups(1000, 400, this.tivImportsGroups, this.upperBoundYear);
    });
  }

  humanizeImportExportData(data) {
    const humanizeData =  data.map(tivImport => {
      const typeKeys = Object.keys(tivImport).filter(key => key !== 'Year');
      const newData: { [key: string]: number | string } = {};
      typeKeys.forEach(d => {
        newData[d] = +tivImport[d];
      });
      newData.year = tivImport.Year; // Assuming 'Year' is the key you want for the 'name' property
      return newData;
    });

    return humanizeData;
  }


  humanizeArmsExportData(data) {
    const parseTime = d3.timeParse('%Y');
    data = data.map(row => {
      return {
        year: parseTime(row.Year),
        ...Object.fromEntries(Object.entries(row).filter(([key]) =>
            key !== 'Year' && key !== 'Total'
        ).map(([key, value]) => [key, +value]))
    };
    });

    return data;
  }
  calculateSumAndSort(data) {
  // Create an object to store the total values for each country
  const countryTotals = {};
  // Iterate through each entry in the data
  data.forEach(entry => {
    // Iterate through each country in the entry
    Object.keys(entry).forEach(country => {
      // Skip the 'year' and 'Total' keys
      if (country !== 'year' && country !== 'Total') {
        // Add the value to the corresponding country total
        countryTotals[country] = (countryTotals[country] || 0) + entry[country];
      }
    });
  });

   // Convert the countryTotals object into an array of objects
  const countryTotalsArray = Object.keys(countryTotals).map(country => ({
    country,
    total: countryTotals[country]
  }));

  // Sort the array by total value in descending order
  countryTotalsArray.sort((a, b) => b.total - a.total);
  return countryTotalsArray;

  }

  groupTIVImports(data, upperBoundYear){
    // Get the last five years' values
    const lastFiveYearsData = data.slice(-5);
    let  fiveYearsBeforeLast = [];
    // Find the index of the last year
    const lastYearIndex = data.findIndex(entry =>  entry.year == (upperBoundYear - 5));
    // Check if the last year is found
    if (lastYearIndex !== -1) {
      // Get the 5 years before the last year
      fiveYearsBeforeLast = data.slice(Math.max(0, lastYearIndex - 5), lastYearIndex);
    } else {
      console.log('Last year not found in the data');
    }

  // Select the top 10 values
    const top10Values = this.calculateSumAndSort(lastFiveYearsData).slice(0, 10);
  // Extract only the country names from the result
    const top10Countries = top10Values.map(item => item.country);

    const fiveYearsBeforeLastSum = this.calculateSumAndSort(fiveYearsBeforeLast);

  // Map the matching country to fiveYearsBeforeLastSum values
    const matchingValues = fiveYearsBeforeLastSum.map(item => {
    // Check if the country is in the top 10
    if (top10Countries.includes(item.country)) {

      const matchingTop10Value = top10Values.find(top10Item => top10Item.country === item.country);
      // Map the country to its corresponding values
      return {
        country: item.country,
        previousValue: item.total,
        newValue: matchingTop10Value.total   // You can customize this to match your data structure
      };
    }
    return null; // Return null for countries not in the top 10
  }).filter(Boolean); // Remove null entries
    return  matchingValues || [];
  }

  humanizeRegionalExpensesData(data, upperBoundYear) {
    const parsedData = data.map(d => {
      const years = Object.keys(d).filter(year => year !== 'Region');
      const values = Object.values(d).filter(value => value !== 'World');

      const numericYears = years.map(parseFloat).filter(value => !isNaN(value));
      const numericValues = values.map(val => (typeof val === 'string' ? parseFloat(val) : 0));

      const groupedData: { [key: string]: number | string } = {};
      let currentYear = Math.min(...numericYears);

      while (currentYear <= Math.max(...numericYears)) {
        const groupStart = currentYear;
        let groupEnd = currentYear + 9;
        groupEnd = Math.min(groupEnd, upperBoundYear);
        const groupKey = `${groupStart.toFixed(0)}-${groupEnd.toFixed(0)}`;

        const valuesInGroup = numericValues
          .filter((value, index) => numericYears[index] >= groupStart && numericYears[index] <= groupEnd)
          .map(value => (isNaN(value) ? 0 : value));

        const averageValue = valuesInGroup.length > 0 ? valuesInGroup.reduce((sum, value) => sum + value, 0) / valuesInGroup.length : 0;

        groupedData[groupKey] = Math.floor(parseFloat(averageValue.toFixed(2)));
        groupedData.region_info = d.Region;

        currentYear += 10;
      }

      return groupedData;
    });

    const cleanData = parsedData.filter(d => d.region_info !== 'World').sort((a, b) => b.total - a.total);

    const groupedData = cleanData.reduce((result, entry) => {
      Object.keys(entry).forEach(key => {
        if (key !== 'region_info' && key !== 'total') {
          if (!result[key]) {
            result[key] = { Year: key };
          }
          result[key][entry.region_info] = entry[key];
        }
      });

      return result;
    }, []);
    return Object.values(groupedData) || [];
  }

  getSliderTickInterval(): number | 'auto' {
    if (this.showTicks) {
      return this.autoTicks ? 'auto' : this.tickInterval;
    }

    return 0;
  }
  getTopTenExports(data, upperBoundYear) {
    const lastYearData = data.find(d => d.year == upperBoundYear) || {};
    const resultData = {};
    const typeKeys = Object.keys(lastYearData).filter(key => key !== 'year');
    typeKeys.forEach(function(d, key){
      resultData[d] = +lastYearData[d];
    });
   // Convert the object to an array of objects
    const dataArray = Object.entries(resultData).map(([country, value]) => ({ country, value }));

    interface ExporterData {
      country: string;
      value: number;
      total?: number; // Optional property
    }
    // Sort the array based on the 'value' property in descending order
    dataArray.sort((a, b) =>  (b.value as number) - (a.value as number));
    // // Take the top 11 values
    const topExporter = dataArray.slice(0, 11);
    // @ts-ignore
    const othersValue = topExporter
    .filter(entry => entry.country !== 'Total')
    .reduce((sum, entry) => sum + (entry.value as number), 0);

    const totalData = topExporter.find(d => d.country == 'Total') as ExporterData | undefined;
    const totalSum = (totalData?.value as number) || 0;

    if (totalData){
      totalData.country = 'Others';
      totalData.value = totalSum - othersValue;
      totalData.total = totalSum ;
    }
    return topExporter || [];
  }

  showTopExporter(width, height, data) {
    const margin = {top: 80, right: 10, bottom: 10, left: 10};
    width = width - margin.left - margin.right;
    height = height - margin.top - margin.bottom;
    const svg = d3.select('#global-share')
                .append('svg')
                .attr('viewBox', '0 0 1000 400')
                .attr('preserveAspectRatio', 'xMidYMid')
                .style('max-width', 1200)
                .style('margin', 'auto')
                .style('display', 'flex')
                .append('g')
    .attr('transform', `translate(${width / 2}, ${height / 1.5})`);
    const topTenData = data.filter(d => d.country !== 'Others');


    const othersValue = data
    .filter(entry => entry.country !== 'Total')
    .reduce((sum, entry) => sum + entry.value, 0);

    const totalData = data.find(d => d.country == 'Others');

    const countries = data.map(entry => entry.country);
    const customColorRange = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
    // color palette
    const color = d3.scaleOrdinal()
    .domain(countries)
    .range(customColorRange);

    const pie = d3.pie()
      .value(d => +d.value)
      .sort(null);

    const dataPrepared = pie(data);
    const radius = Math.min(width, height) / 2 - 10;
    const arc = d3.arc()
      .innerRadius(radius / 2.3)
      .outerRadius(radius);

        // Another arc that won't be drawn. Just for labels positioning
    const outerArc = d3.arc()
        .innerRadius(radius / 1.2)
        .outerRadius(radius * 1.5);


    data.forEach(function(d) {
          d.funding_value = +d.value;
          d.enabled = true;
        });

    const total = totalData ? totalData.total : 0;

      // create a tooltip
    const tooltip = d3.select('body')
      .append('div')
        .attr('class', 'tooltip')
        .attr('font-size', '12px');

      // tooltip events
    const mouseover = function(d) {
        tooltip
            .style('opacity', 1);
        d3.select(this)
            .style('opacity', .5);
      };
    const f = d3.format(',.0f');
    const mousemove = function(event, d) {
      const percent = Math.round(1000 * d.data.value / total) / 10;
      tooltip
      .html(`<b>${d.data.country}</b>: ` + percent + '%')
            .style('top', event.pageY - 10 + 'px')
            .style('left', event.pageX + 10 + 'px');
      };
    const mouseleave = function(d) {
        tooltip
            .style('opacity', 0);
        d3.select(this)
            .style('stroke', 'none')
            .style('opacity', 1);
      };


    svg
      .selectAll('path')
      .data(dataPrepared)
      .join('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.country))
        .attr('stroke', '#ffffff')
        .style('stroke-width', '2px')
        .each(function(d) { this._current - d; })
        .on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseleave', mouseleave);

    svg
      .append('g')
      .attr('text-anchor', 'middle')
      .selectAll('text')
      .data(dataPrepared)
      .join('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`);
        // Add the polylines between chart and labels:
    svg
      .selectAll('allPolylines')
      .data(dataPrepared)
      .enter()
      .append('polyline')
        .attr('stroke', 'black')
        .style('fill', 'none')
        .attr('stroke-width', 1)
        .attr('points', function(d) {
          const posA = arc.centroid(d); // line insertion in the slice
          const posB = outerArc.centroid(d); // line break: we use the other arc generator that has been built only for that
          const posC = outerArc.centroid(d); // Label position = almost the same as posB
          const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;

          // Adjust the label position based on the midangle
          if (d.index >= dataPrepared.length - 1) {
            // For the last three data points, set the label position at a 45-degree angle
            posC[0] = radius * 1.4 * Math.cos(midangle - Math.PI / 3);
            // posC[1] = radius * 1.5 * Math.cos(midangle - Math.PI);
          }else if (d.index >= dataPrepared.length - 2) {
            posC[1] = radius * 1.25 * Math.cos(midangle - Math.PI);
          }
          else{
            // For other data points, adjust the label position as before
            posC[0] = radius * 1.4 * (midangle < Math.PI ? 1 : -1);
          }

          return [posA, posB, posC];
        });

      // Add the polylines between chart and labels:
    svg
      .selectAll('allLabels')
      .data(dataPrepared)
      .enter()
      .append('g')
      .attr('class', 'label-container')
      .attr('transform', function(d) {
          const pos = outerArc.centroid(d);
          const midangle = d.startAngle - (d.endAngle - d.startAngle) / 19;
          if (d.index >= dataPrepared.length - 1) {
            // For the last three data points, set the label position at a 45-degree angle
            pos[0] = radius * 1.4 * Math.cos(midangle - Math.PI / 3);
            // pos[1] = radius * 1.5 * Math.cos(midangle - Math.PI);
          }
          else if (d.index >= dataPrepared.length - 2) {
            pos[0] = radius * 0.3 * Math.sin(midangle - Math.PI) / 4;
            pos[1] = radius * 1.3 * Math.sin(midangle - Math.PI / 2);
          }
          else{
            pos[0] = radius * 1.2 * (midangle < Math.PI ? 1 : -1); // Adjust the multiplier for positioning
          }
          return 'translate(' + pos + ')';
      })
      .each(function(d) {
          d3.select(this)
              .append('text')
              .attr('class', 'label-type')
              .attr('dy', '-0.2em')
              .attr('font-size', '8px')
              .text(`${d.data.country}:  ${d.data.value.toLocaleString()}`);
      })
      .style('text-anchor', function(d) {
          const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          return (midangle < Math.PI ? 'start' : 'end');
      });

    svg
        .append('text')
          .attr('dy', '-0.2em')
          .style('font-size', '12px')
          .style('text-anchor', 'middle')
          .attr('class', 'inner-circle')
          .attr('fill', '#222222')
          .text('Total Expenses');
    svg
        .append('text')
          .attr('dy', '1em')
          .style('font-size', '12px')
          .style('text-anchor', 'middle')
          .attr('class', 'inner-circle')
          .attr('fill', '#222222')
          .text(f(total));
  }

  showRegionalExpenses(width, height, data) {
    const margin = {top: 90, right: 90, bottom: 10, left: 90};
    width = width - margin.left - margin.right;
    height = height - margin.top - margin.bottom;
    const svg = d3.select('#regional-expenses')
                .append('svg')
                .attr('x', 0)
                .attr('y', 0)
                .attr('viewBox', '0 0 1000 600')
                .attr('preserveAspectRatio', 'xMidYMid')
                .style('max-width', 1200)
                .style('margin', 'auto')
                .style('display', 'flex')
                .append('g')
                .attr('transform', `translate(${margin.left}, ${margin.top})`);
    const typeKeys = Object.keys(data[0]).filter(k => k != 'Year');
    // stack the data
    const stack = d3.stack()
  .keys(typeKeys)
  .order(d3.stackOrderNone)
  .offset(d3.stackOffsetNone);
    const stackedData = stack(data);

  // X scale and Axis
    const formater =  d3.format('.0f');
    const xScale = d3.scaleLinear()
    .domain([0, d3.max(stackedData[stackedData.length - 1], function(d) { return d[1]; })])
    .range([0, width]);
    svg
  .append('g')
  .attr('transform', `translate(0, ${height})`)
  .call(d3.axisBottom(xScale).ticks(7).tickSize(0).tickPadding(6).tickFormat(formater))
  .call(d => d.select('.domain').remove());

// Y scale and Axis
    const yScale = d3.scaleBand()
  .domain(data.map(d => d.Year))
  .range([0, height])
  .padding(.5);
    svg
  .append('g')
  .call(d3.axisLeft(yScale).tickSize(0).tickPadding(8));

  // const color = d3.scaleOrdinal(d3.schemeCategory10);
    const color = d3.scaleOrdinal()
  .domain(typeKeys)
  .range(['#82b74b', '#f28a35', '#4682B4', '#c45e66', '#4169E1']);
  // set vertical grid line
    const GridLine = function() {return d3.axisBottom().scale(xScale); };
    svg
  .append('g')
    .attr('class', 'grid')
  .call(GridLine()
    .tickSize(height, 0, 0)
    .tickFormat('')
    .ticks(8)
);

// create a tooltip
    const tooltip = d3.select('body')
  .append('div')
    .attr('id', 'chart')
    .attr('class', 'tooltip');

// tooltip events
    const mouseover = function(d) {
    tooltip
      .style('opacity', .8);
    d3.select(this)
      .style('opacity', .5);
};

    const mousemove = function(event, d) {
  const formater = d3.format(',');
  tooltip
  .html(formater(d[1]))
  .style('top', event.pageY - 10 + 'px')
  .style('left', event.pageX + 10 + 'px');
};
    const mouseleave = function(d) {
    tooltip
      .style('opacity', 0);
    d3.select(this)
      .style('opacity', 1);
};

// create bars
    svg.append('g')
  .selectAll('g')
  .data(stackedData)
  .join('g')
      .attr('fill', function(d) { return  color(d.key); })
    .selectAll('rect')
    .data(d => d)
    .join('rect')
      .attr('x', d => xScale(d[0]))
      .attr('y', d => yScale(d.data.Year))
      .attr('width',  d => {
        // Check for NaN in d[1]
        if (isNaN(d[1])) {
          // Handle NaN (e.g., set width to a default value)
          return 0;
        }
        return xScale(d[1]) - xScale(d[0]);
      })
      .attr('height', yScale.bandwidth())
      .on('mouseover', mouseover)
      .on('mousemove', mousemove)
      .on('mouseleave', mouseleave);

// set Y axis label
    svg
  .append('text')
    .attr('class', 'chart-label')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom / 0.25)
    .attr('text-anchor', 'middle')
  .text('Expenditure (in billions)');

    const legend = svg.append('g')
  .attr('class', 'legend')
  .attr('transform', 'translate(' + margin.left + ',' + -margin.top / 1.5 + ')'); // Adjusted the transform for top positioning

    const legendItem = legend.selectAll('.legend-item')
  .data(typeKeys)
  .enter().append('g')
  .attr('class', 'legend-item')
  .attr('transform', (d, i) => 'translate(' + (i * 140) + ', 0)'); // Adjusted the transform for horizontal positioning

    legendItem.append('rect')
  .attr('x', 0)
  .attr('width', 18)
  .attr('height', 18)
  .attr('fill', d => color(d));

    legendItem.append('text')
  .attr('x', 24)
  .attr('y', 9)
  .attr('dy', '.35em')
  .style('text-anchor', 'start')
  .text(d => d);
  }

  showTIVImportsGroups(width, height, data, upperBoundYear) {
    data.sort(() => Math.random() - 0.5);
    const margin = {top: 90, right: 90, bottom: 10, left: 90};
    width = width - margin.left - margin.right;
    height = height - margin.top - margin.bottom;
    const svg = d3.select('#global-exports')
                .append('svg')
                .attr('x', 0)
                .attr('y', 0)
                .attr('viewBox', '0 0 1000 600')
                .attr('preserveAspectRatio', 'xMidYMid')
                .style('max-width', 1200)
                .style('margin', 'auto')
                .style('display', 'flex')
                .append('g')
                .attr('transform', `translate(${margin.left}, ${margin.top})`);
    const formatValueInK = d3.format('.2s');


    // X scale and Axis
    const xScalePrevious = d3.scaleLinear()
    .domain([0, d3.max(data, d => +d.previousValue)])
    .range([width / 2, 0]);
    svg
    .append('g')
        .attr('transform', `translate(0, ${height})`)
    .call(d3.axisBottom(xScalePrevious).tickSize(0).tickPadding(3).ticks(7).tickFormat(value => formatValueInK(value)))
    .call(function(d) { return d.select('.domain').remove(); });

    const xScalePresent = d3.scaleLinear()
    .domain([0, d3.max(data, d => +d.newValue)])
    .range([width / 2, width]);
    svg
    .append('g')
        .attr('transform', `translate(0, ${height})`)
    .call(d3.axisBottom(xScalePresent).tickSize(0).tickPadding(3).ticks(7).tickFormat(value => formatValueInK(value)))
    .call(function(d) { return d.select('.domain').remove(); });

  // set vertical grid line
    const GridLineF = function() { return d3.axisBottom().scale(xScalePresent); };
    svg
    .append('g')
      .attr('class', 'grid')
    .call(GridLineF()
      .tickSize(height, 0, 0)
      .tickFormat('')
      .ticks(7)
  );
    const GridLineM = function() { return d3.axisBottom().scale(xScalePrevious); };
    svg
    .append('g')
      .attr('class', 'grid')
    .call(GridLineM()
      .tickSize(height, 0, 0)
      .tickFormat('')
      .ticks(7)
  );


  // Y scale and Axis
    const yScale = d3.scaleBand()
      .domain(data.map(d => d.country))
      .range([height, 0])
      .padding(.25);
    svg
      .append('g')
      .call(d3.axisLeft(yScale).tickSize(0).tickPadding(15))
      .call(d => d.select('.domain').remove());

  // create a tooltip
    const tooltip = d3.select('body')
    .append('div')
      .attr('class', 'tooltip');

  // tooltip events
    const mouseover = function(d) {
      tooltip
        .style('opacity', 1);
      d3.select(this)
        .style('stroke', '#EF4A60')
        .style('opacity', .5);
  };
    const mousemove1 = function(event, d) {

      tooltip
      .html( `${d.previousValue}`)
        .style('top', event.pageY - 10 + 'px')
        .style('left', event.pageX + 10 + 'px');
  };
    const mousemove2 = function(event, d) {
    tooltip
    .html( `${d.newValue}`)
      .style('top', event.pageY - 10 + 'px')
      .style('left', event.pageX + 10 + 'px');
};
    const mouseleave = function(d) {
      tooltip
        .style('opacity', 0);
      d3.select(this)
        .style('stroke', 'none')
        .style('opacity', 1);
  };

  // create previous bars
    svg
    .selectAll('.previousBar')
      .data(data)
    .join('rect')
      .attr('class', 'barPrevious')
      .attr('x', d => xScalePrevious(d.previousValue))
      .attr('y', d => yScale(d.country))
      .attr('width', d => width / 2 - xScalePrevious(d.previousValue))
      .attr('height', yScale.bandwidth())
      .style('fill', '#18375F')
    .on('mouseover', mouseover)
    .on('mousemove', mousemove1)
    .on('mouseleave', mouseleave);

  // create present bars
    svg
      .selectAll('.presentBar')
        .data(data)
      .join('rect')
        .attr('class', 'barPresent')
        .attr('x', xScalePresent(0))
        .attr('y', d => yScale(d.country))
        .attr('width', d => xScalePresent(d.newValue) - xScalePresent(0))
        .attr('height', yScale.bandwidth())
        .style('fill', '#0072BC')
      .on('mouseover', mouseover)
      .on('mousemove', mousemove2)
      .on('mouseleave', mouseleave);

        //set legend
    svg
      .append("rect")
          .attr("x", -(margin.left)*0.7)
          .attr("y", -(margin.top/3.2))
          .attr("width", 13)
          .attr("height", 13)
          .style("fill", "#18375F")
    svg
      .append("text")
          .attr("class", "legend")
          .attr("x", -(margin.left)*0.6+15)
          .attr("y", -(margin.top/5.5))
      .text(`Previous comparison (${upperBoundYear -10} - ${upperBoundYear-5})`)
    svg
      .append("rect")
          .attr("x", 210)
          .attr("y", -(margin.top/3.2))
          .attr("width", 13)
          .attr("height", 13)
          .style("fill", "#0072BC")
    svg
      .append("text")
          .attr("class", "legend")
          .attr("x", 230)
          .attr("y", -(margin.top/5.5))
      .text(`Present (${upperBoundYear -5} - ${upperBoundYear})`)
  
      }

  showTIVInfo(width, height, data) {
    const margin = {top: 90, right: 90, bottom: 10, left: 90};
    const lineOpacity = '0.8';
    const lineOpacityHover = '1';
    const otherLinesOpacityHover = '0.55';
    const lineStroke = '1px';
    const lineStrokeHover = '1.5px';
    const  circleOpacityOnLineHover = '0.25';
    const circleOpacity = '0.85';
    const marginAll = 50;

    width = width - margin.left - margin.right;
    height = height - margin.top - margin.bottom;
    const svg = d3.select('#trade-info')
                .append('svg')
                .attr('x', 0)
                .attr('y', 0)
                .attr('viewBox', '0 0 1000 600')
                .attr('preserveAspectRatio', 'xMidYMid')
                .style('max-width', 1200)
                .style('margin', 'auto')
                .style('display', 'flex')
                .append('g')
                .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const xScale = d3.scaleTime().domain(d3.extent(data, d => d.year)).range([0, width]);
    svg.append('g').attr('transform', `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).tickSize(0).tickPadding(8));
    const typeKeys = Object.keys(data[0]).filter(key => key !== 'year');
    const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d3.max(typeKeys, key => d[key]))]).range([height, 0]);

    const formatter =  d3.format('~s');
    svg
    .append('g')
    .call(d3.axisLeft(yScale).ticks(6).tickSize(0).tickPadding(6).tickFormat(formatter))
    .call(d => d.select('.domain').remove());

    const GridLine = () => d3.axisLeft().scale(yScale);
    svg
      .append('g')
        .attr('class', 'grid')
      .call(GridLine()
        .tickSize(-width, 0, 0)
        .tickFormat('')
        .ticks(6)
    );
  // Define a custom color scale excluding black
    const colorScale = d3.scaleOrdinal()
  .domain(typeKeys)
  .range(['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#00ff00']);

// Add lines
    const lines = svg.selectAll('lines')
  .data(typeKeys)
  .enter().append('g')
  .attr('class', 'line')
  .on('mouseover', function(d, i) {
    svg.append('text')
      .attr('class', 'title-text')
      .style('fill', colorScale(i))
      .text(i)
      .attr('text-anchor', 'middle')
      .attr('x', (width - marginAll) / 2)
      .attr('y', 5);
  })
.on('mouseout', function(d) {
    svg.select('.title-text').remove();
  }).append('path')
  .attr('class', 'line')
  .attr('d', key => d3.line()
        .curve(d3.curveCardinal)
        .x(d => xScale(d.year))
        .y(d => yScale(d[key]))
        (data))
  .style('fill', 'none')
  .style('stroke', key => colorScale(key))
  .style('opacity', lineOpacity)
  .attr('d', function(key){
      return d3.line()
        .curve(d3.curveCardinal)
        .x(d => xScale(d.year))
        .y(d => yScale(d[key]))
        (data);
    })
.on('mouseover', function(d) {
    d3.selectAll('.line')
        .style('opacity', otherLinesOpacityHover);
    d3.selectAll('.circle')
        .style('opacity', circleOpacityOnLineHover);
    d3.select(this)
      .style('opacity', lineOpacityHover)
      .style('stroke-width', lineStrokeHover)
      .style('cursor', 'pointer');
  })
.on('mouseout', function(d) {
    d3.selectAll('.line')
        .style('opacity', lineOpacity);
    d3.selectAll('.circle')
        .style('opacity', circleOpacity);
    d3.select(this)
      .style('stroke-width', lineStroke)
      .style('cursor', 'none');
  });



  // Add legend above the chart
    const legend = svg.append('g')
  .attr('class', 'legend')
  .attr('transform', `translate(0, -60)`);

    const legendItemsPerRow = 6;
    const legendItemWidth = 140; // Adjust as needed
    const legendItemPadding = 3; // Adjust as needed
    const rowSpacing = 12; // Adjust as needed


    legend.selectAll('g')
    .data(typeKeys)
    .enter().append('g')
    .attr('transform', (d, i) => `translate(${i % legendItemsPerRow * (legendItemWidth + legendItemPadding)},${Math.floor(i / legendItemsPerRow) * (rowSpacing + 12)})`) // Adjusted for padding and row spacing
    .append('rect')
    .attr('width', 12)
    .attr('height', 12)
    .style('fill', key => colorScale(key));

    legend.selectAll('text')
    .data(typeKeys)
    .enter().append('text')
    .attr('x', (d, i) => i % legendItemsPerRow * (legendItemWidth + legendItemPadding) + 20) // Adjusted for padding
    .attr('y', (d, i) => Math.floor(i / legendItemsPerRow) * (rowSpacing + 12) + 9) // Adjusted for row spacing
    .attr('dy', '.1em')
    .style('text-anchor', 'start')
    .style('font-size', '12px') // Adjust the font size
    .text(d => d);

  }

  setMap(width, height, topology, polylines, data) {

    d3.select('#stop').style('visibility', 'hidden');

    this.titleTag = `TIV of Arms ${this.scenario} in ${data?.year}`;
    this.currentYear = data?.year;
    const margin = {top: 10, right: 30, bottom: 0, left: 90};

    width = width - margin.left - margin.right;
    height = height - margin.top - margin.bottom;

    // const typeKeys = Object.keys(lastTivImportElement).filter(key => key !== 'Year');
    const projection = d3.geoMercator()
    .rotate([0, 0])
    .scale(80);

    let svg = d3.select('.world-map').select('svg');
    // Check if the SVG doesn't exist, create it
    if (svg.empty()) {
      svg = d3.select('.world-map')
                .append('svg')
                .attr('class', 'map')
                .attr('x', 0)
                .attr('y', 0)
                .attr('viewBox', '0 0 1000 600')
                .attr('preserveAspectRatio', 'xMidYMid')
                .style('max-width', 1200)
                .style('margin', 'auto')
                .style('display', 'flex');

    } else {
      // Clear existing content if the SVG already exists
      svg.selectAll('*').remove();
    }

    // declare polygon, polyline and bubble
    const poly = svg.append('g');
    const line = svg.append('g');

    const path = d3.geoPath()
    .projection(projection);

// set color scale
    const color = d3.scaleThreshold()
        .domain([10, 100, 1000, 10000])
        .range(['#DCE9FF', '#8EBEFF', '#589BE5', '#0072BC'])
        .unknown('#E6E6E6');


    // Append a group element for the tooltip
    const tooltip = svg.append('g')
    .style('display', 'none');

    // Add a background rectangle for the tooltip
    tooltip.append('rect')
    .attr('width', 180)
    .attr('height', 45)
    .attr('fill', 'white')
    .style('opacity', 0.8);

    // Add text elements for the tooltip content
    const tooltipText1 = tooltip.append('text')
    .attr('x', 10)
    .attr('y', 15)
    .style('font-size', '11px')
    .style('fill', '#0072BC');

    const tooltipText2 = tooltip.append('text')
    .attr('x', 10)
    .attr('y', 30)
    .style('font-size', '10px')
    .style('fill', 'black');


    const mousemove = function(event, d) {
      // Handle the mouseover event to display the tooltip
    tooltip.style('display', 'block');

    // Update tooltip content based on your data
    tooltipText1.text(d.properties.gis_name);
    tooltipText2.text('Expenses (in millions): ' + d3.format(',')(data[d.properties.iso3] || 0));

    // Position the tooltip near the mouse pointer
    const [x, y] = d3.pointer(event);
    tooltip.attr('transform', `translate(${x + 10},${y - 10})`);
    };

    const mouseover = function(d) {
      d3.selectAll('.countries')
        .transition()
        .duration(100)
        .style('opacity', .3);
      d3.select(this)
        .transition()
        .duration(100)
        .style('opacity', 1);
      tooltip
          .style('opacity', 1);
    };
    const mouseleave = function(d) {
      d3.selectAll('.countries')
        .transition()
        .duration(100)
        .style('opacity', 1);
      d3.select(this)
        .transition()
        .duration(100)
        .style('opacity', 1);
      tooltip.style('opacity', 0);
    };


    poly
        .selectAll('path')
        .data(topojson.feature(topology, topology.objects.world_polygons_simplified).features)
        .join('path')
        .attr('fill',  (d) => color(data[d.properties.iso3] || 0))
        .attr('d', path)
        .attr('class', 'countries' )
        .on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseleave', mouseleave);

    line.selectAll('path')
      .data(topojson.feature(polylines, polylines.objects.world_lines_simplified).features)
      .enter()
      .append('path')
      .attr('d', path)
      .style('fill', 'none')
      .attr('class', (d) => d.properties.type);

    svg.append('g')
      .attr('class', 'legendThreshold')
      .style('font-size', 12)
      .attr('transform', 'translate(5,255)');

    const colorLegend = legendColor()
        .labelFormat(d3.format(',.0f'))
        .labels(legendHelpers.thresholdLabels)
        .labelOffset(6)
        .shapePadding(5)
        .scale(color);

    svg.select('.legendThreshold')
      .call(colorLegend);
    // set note
    svg
.append('text')
    .attr('class', 'note')
    .attr('x', width * 0.01)
    .attr('y', height * 0.70)
    .attr('text-anchor', 'start')
    .style('font-size', 10)
.text('Source: SIPRI Trade Import, Generated: 12 December 2023');
    svg
.append('text')
    .attr('class', 'note')
    .attr('x', width * 0.01)
    .attr('y', height * 0.72)
    .attr('text-anchor', 'start')
    .style('font-size', 10)
.text('The boundaries and names shown and the designations used on this map do not imply official endorsement or acceptance by the United Nations.');
    }
    selectScenario(scenario){
      if (scenario !== this.scenario){
        this.scenarioImport = scenario !== 'Exports';
        this.scenarioExport = !this.scenarioImport;
        this.scenario = scenario;
        // this.jsons = this.jsons_a2;
        d3.select('svg').remove();
        const data = scenario == 'Exports' ? this.tivExports : this.tivImports;
        const [firstTivImportElement, lastTivImportElement] = [data[0], data[data.length - 1]];
        this.upperBoundYear =  lastTivImportElement?.year;
        this.lowerBoundYear =  firstTivImportElement?.year;
        this.yearRange =  data.map(tivImport => tivImport.year);
        this.setMap(1000, 600, this.topology, this.polylines, firstTivImportElement);
      }
    }

    refreshButton() {
      let width = window.innerWidth;

      if (width > 1000) {
        width = 1000;
      }

      d3.select('svg').remove();
      this.setMap(1000, 600, this.topology, this.polylines, this.tivImports[0]);

      this.play = false;
      this.refresh = false;
    }

    playButton() {

      this.play = true;
      this.progress = true;
      let time = 1;
      const interval = setInterval(() => {
        if (time <= this.yearRange.length) {
            this.transitionMap(this.tivImports, time);
            time++;
        }
        else {
            clearInterval(interval);
            this.progress = false;
            this.refresh = true;
        }
      }, 1000);

    }
    pitch(event: any) {
      this.sliderDate = event.value;
      this.thumbLabel = true;
      const i = this.yearRange.indexOf(this.sliderDate.toString());
      this.transitionMap(this.tivImports, i);
    }

    transitionMap(json, i) {
      if (this.tivImports[i]){
        this.currentYear = this.yearRange[i];
        this.setMap(1000, 600, this.topology, this.polylines, this.tivImports[i]);
      }
    }


    scrollDiv($element): void {
      $element.scrollIntoView({behavior: 'smooth', block: 'start', inline: 'nearest'});
    }


  }
