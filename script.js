const standardTrackFilter = browserSupport => (status, support) => {
  if (status.standard_track == true) {
    return Object.entries(browserSupport).every(
      ([browser, version]) => {
        if (browser in support == false) return false; // It's not in the selected browser. Compat data doesn't exist.
        if (support[browser].version_added === true) return true;
        return parseFloat(support[browser].version_added) <= parseFloat(version)
      }
    );
  }
  return false;
};

const onDateChanged = e => {
  const { data, date, areas } = readState();

  const newDate = new Date(e.target.value);
  const mustSupport = browsersBefore(data.browsers, date);

  updateState({ date: newDate, mustSupport });

  render();
};

const onAreaCheckChanged = e => {
  const { areas } = readState();

  areas[e.target.value] = e.target.checked;

  updateState({ areas });
  render();
};

const onBrowserCheckChanged = e => {
  if (e.target.type != "checkbox") return e.preventDefault();
  
  const { data, browsers, date, mustSupport } = readState();
  
  browsers[e.target.value] = e.target.checked;
  
  if(e.target.checked == false) {
    delete mustSupport[e.target.value];
  }
  else {
    const releases = browsersBefore(data.browsers, date);
    mustSupport[e.target.value] = releases[e.target.value];
  }
  
  updateState({ browsers, mustSupport });
  render();
};

onload = async () => {
  const response = await fetch(
    "https://unpkg.com/@mdn/browser-compat-data@3.3.7/data.json"
  );
  const data = await response.json();
  const date = new Date;
  
  // Onload we must support all browsers.
  const mustSupport = browsersBefore(data.browsers, date);
  const browsers = {};
  
  Object.keys(mustSupport).forEach((k) => browsers[k] = true);

  const browsersBeforePicker = document.getElementById("browsersBeforePicker");
  browsersBeforePicker.onchange = onDateChanged;
  browsersBeforePicker.valueAsDate = date;

  const areaNodes = document.getElementsByName("areas");

  for (let checkbox of areaNodes) {
    checkbox.addEventListener("change", onAreaCheckChanged);
  }
  
  const versions = document.getElementById("versions");
  versions.addEventListener("change", onBrowserCheckChanged);
  
  updateState({ data , areas: {}, browsers, date, mustSupport});
  render()
};

let applicationState = {};

const updateState = state => {
  applicationState = { ...applicationState, ...state };
};

const readState = () => {
  return applicationState;
};

const render = () => {
  const { browsers = {}, mustSupport = {}, areas = {}, data } = readState();

  const features = document.getElementById("features");
  const versionList = document.getElementById("versionList");
  const featureCountElement = document.getElementById("featureCount");

  let itemHTML = "";
  let versionHTML = ""
  
  for (let [browser, checked] of Object.entries(browsers)) {
    versionHTML += `<label><input type="checkbox" name="browserVersion" ${ (checked ? "checked" : "") } value="${browser}"> ${data.browsers[browser].name} ${browser in mustSupport ? mustSupport[browser] : ''} </label>`
  }
  
  versionList.innerHTML = versionHTML;

  let featureCount = 0;
  for (let [api, compat] of getFeaturesInBrowsers(data, areas, mustSupport)) {
    itemHTML += `<li>${api}</li>`;
    featureCount ++;
  }
  
  features.innerHTML = itemHTML;
  featureCountElement.innerText = featureCount;
};

function* getFeaturesInBrowsers(data, areas, browserSupport) {
  for (const [api, info] of featuresWith(
    areas,
    data,
    standardTrackFilter(browserSupport)
  )) {
    yield [api, info];
  }
}

const browsersBefore = (browsers, date) => {
  const releases = {};
  
  delete browsers["nodejs"];
  delete browsers["opera_android"];
  
  for (let [browser, browserData] of Object.entries(browsers)) {
    for (let [release, releaseData] of Object.entries(
      browserData.releases
    ).sort((a, b) => parseFloat(a) - parseFloat(b))) {
      let releaseDate = new Date(releaseData.release_date);
      if (releaseDate < date) {
        releases[browser] = release; // chrome: 57 was the last version before 'date'
      }
    }
  }

  return releases;
};

function* itterateFeatures(area, api) {
  for (let [topLevelAPI, information] of Object.entries(api)) {
    const namespaceAPI = `${area}.${topLevelAPI}`;
    if (topLevelAPI.startsWith("__")) {
      continue;
    }

    yield [namespaceAPI, information];
    // Recurse
    yield* itterateFeatures(namespaceAPI, information);
  }
}

function* featuresWith(areas, data, filter) {
  for (let [area, api] of Object.entries(data).filter(
    ([key]) => key in areas && areas[key] == true
  )) {
    const features = itterateFeatures(area, api);
    for (let [topLevelAPI, information] of features) {
      // Get all the features. Check their support.
      if ("__compat" in information == false) {
        continue;
      }
      
      const { status, support } = information.__compat;

      if (filter(status, support)) {
        yield [topLevelAPI, information];
      }
    }
  }
}
