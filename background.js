// function that injects code to a specific tab
function injectScript(tabId) {

    chrome.scripting.executeScript(
        {
            target: {tabId: tabId},
            files: ['inject.js'],
        }
    );

}

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
});
