/* All calculations use SI units. Diameter arguments and returned lengths are in nm. */
(function(root){
  'use strict';
  const R=8.3145, Vm=18e-6;
  function gamma(c){return .1215-.0001662*(c+273.15);}
  function kelvinLength(c){return 4*gamma(c)*Vm/(R*(c+273.15))*1e9;}
  function threshold(c,d){return 100*Math.exp(-kelvinLength(c)/d);}
  function criticalDiameter(c,rh){return rh>=100?Infinity:rh<=0?0:-kelvinLength(c)/Math.log(rh/100);}
  // Largest pore that is filled BY the target RH at EVERY temperature.
  // D must be <= Dcritical(T,target), so the warm endpoint sets Dmax.
  function design(target,minD){return {largest:criticalDiameter(40,target),coldLargest:criticalDiameter(-10,target),minimum:threshold(40,minD),coldMinimum:threshold(-10,minD)};}
  root.Kelvin={R,Vm,gamma,kelvinLength,threshold,criticalDiameter,design};
})(typeof window==='undefined'?globalThis:window);
