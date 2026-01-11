// FIND THIS FUNCTION (lines 35-42 approx)
async function news(){
  // OLD (BROKEN): const r=await fetchJSON(origin()+"/tools/news");
  // NEW (FIXED):
  const r=await fetchJSON(api()+"/tools/news"); 
  
  if(!r.ok){$("newsTicker").textContent="News: unavailable";return}
  const heads=r.data.headlines||[];
  let i=0;$("newsTicker").textContent="News: "+(heads[0]||"—");
  setInterval(()=>{i=(i+1)%Math.max(1,heads.length);$("newsTicker").textContent="News: "+(heads[i]||"—")},8000)
}

// FIND THIS FUNCTION (lines 43-50 approx)
async function weather(lat,lon){
  // OLD (BROKEN): const r=await fetchJSON(origin()+`/tools/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
  // NEW (FIXED):
  const r=await fetchJSON(api()+`/tools/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
  
  if(!r.ok){$("weather").textContent="Weather unavailable";return}
  $("weather").textContent=`${r.data.temp_f??"—"}°F • ${r.data.summary??""}`;
  $("weatherMeta").textContent=`Provider: ${r.data.provider||"—"} • Wind: ${r.data.wind_mph??"—"} mph • Humidity: ${r.data.humidity??"—"}%`
}
