// function that injects code to a specific tab
function injectScript(tabId) {

    chrome.scripting.executeScript(
        {
            target: {tabId: tabId},
            files: ['inject.js'],
        }
    );

}

async function onStartUp() {
    var response = await fetch('config.json');
    configVariables = await response.json();
}

var configVariables;

onStartUp();

// adds a listener to tab change
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

    // wait for the page to finish loading before attempting to inject a script
    if (changeInfo.status === 'complete') {
        // before injecting a script, first attempt to contact any existing script
        chrome.tabs.sendMessage(tabId, {action: "checkInjected"}, response => {
            if (chrome.runtime.lastError) {
                // If there is not a response from a content script, it has likely not yet been injected, so inject a content script
                console.log(`Content script not active in tab ${tabId}:`, chrome.runtime.lastError.message);
                injectScript(tabId);
            } else if (response && response.status === "active") {
                // If there is a response with a status of 'active', a content script has already been injected and is active
                console.log(`Content script active in tab ${tabId}`);
            }
        });
    };
    if (changeInfo.url && tab.url.startsWith("https://www.linkedin.com/jobs/search/")) {
        chrome.tabs.sendMessage(tabId, { action: "loadData" });
    }
});


// listen for messages from scripts
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

      // if request contains job posting info, this indicates a corresponding job app was submitted, and the data should be sent to google spreadsheet
      if (request == 'appSubmitted') {

          chrome.storage.local.get(['jobTitle', 'company', 'unknownInput', 'applicationDateTime', 'url'], function(object) {
              fetch(configVariables.scriptURL + '?action=addUser', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(object)
              })
              .then(response => response.json())
              .then(data => {
                  console.log('Response:', data);
              })
          })
      }
      return true
  }
)