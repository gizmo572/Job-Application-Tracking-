chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

    if (request.action === "checkInjected") {
        sendResponse({status: "active"});
        return true;
    }

    if (request.action === "removePrevApplied") {
        chrome.storage.local.get(['prevAppliedJobs'], async function(result) {
            removePrevAppliedFromSearchResults(result.prevAppliedJobs);
        });
    }
    
    if (request.action === "appSubmitted") {
        chrome.storage.local.get(['prevAppliedJobs', 'lastJobAdded'], function(result) {
            var prevAppliedJobs = result.prevAppliedJobs || {};
            var newCompany = result.lastJobAdded.company || null;
            var jobTitle = result.lastJobAdded.jobTitle || null;
            if (newCompany in prevAppliedJobs) {
                prevAppliedJobs[newCompany].push(jobTitle);
            } else prevAppliedJobs[newCompany] = [jobTitle];

            chrome.storage.local.set({ 'prevAppliedJobs': prevAppliedJobs });

            removePrevAppliedFromSearchResults(prevAppliedJobs);
        });
    }

    if (request.action === "loadData") {
        var pageUrl = window.location.href;
        var jobTitle, company, unknownInput, applicationDateTime, url;

        function getCurrentDateTimeFormatted() {
            var now = new Date();
            var year = now.getFullYear();
            var month = (now.getMonth() + 1).toString().padStart(2, '0');
            var day = now.getDate().toString().padStart(2, '0');
            var hours = now.getHours().toString().padStart(2, '0');
            var minutes = now.getMinutes().toString().padStart(2, '0');
            var seconds = now.getSeconds().toString().padStart(2, '0');
            return month + '/' + day + '/' + year + ' ' + hours + ':' + minutes + ':' + seconds;
        }

        if (pageUrl.startsWith("https://www.linkedin.com/jobs/view/")) {
            var pageTitle = document.getElementsByTagName("title")[0].innerHTML;
            var titleParts = pageTitle.split("|").map(part => part.trim());
            jobTitle = titleParts[0] || "";
            company = titleParts[1] || "";
            unknownInput = titleParts[2] || "";
            applicationDateTime = getCurrentDateTimeFormatted();
            url = pageUrl;
        } else if (pageUrl.startsWith("https://www.linkedin.com/jobs/collections/") || pageUrl.startsWith("https://www.linkedin.com/jobs/search/")) {
            jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title-link')?.textContent.trim() || "";
            var companyElement = document.querySelector('.job-details-jobs-unified-top-card__primary-description-without-tagline');
            if (companyElement) {
                var companyText = companyElement.textContent.split('·')[0].trim();
                company = companyText;
            } else {
                company = "";
            }
            listenForApply();
            unknownInput = "Unknown";
            applicationDateTime = getCurrentDateTimeFormatted();
            var jobUrlElement = document.querySelector('.job-details-jobs-unified-top-card__job-title a');
            url = jobUrlElement ? 'https://www.linkedin.com' + jobUrlElement.getAttribute('href') : '';
        } else if (pageUrl.startsWith("https://www.indeed.com/?from=gnav-jobsearch--indeedmobile")) {
            // Scraping from Indeed job listing page
            jobTitle = document.querySelector('.jobsearch-JobInfoHeader-title-container .jobsearch-JobInfoHeader-title')?.textContent.trim() || "";
            company = document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent.trim() || "";
            unknownInput = "Indeed";
            applicationDateTime = getCurrentDateTimeFormatted();
            url = 'N/A';
        }
        else if (pageUrl.startsWith("https://www.indeed.com/jobs")) {
            // Scraping from Indeed jobs  page
            jobTitle = document.querySelector('.jobsearch-JobInfoHeader-title-container .jobsearch-JobInfoHeader-title')?.textContent.trim() || "";
            company = document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent.trim() || "";
            unknownInput = "Indeed";
            applicationDateTime = getCurrentDateTimeFormatted();
            url = 'N/A';
        }
        else if (pageUrl.startsWith("https://www.indeed.com/viewjob")) {
            // Scraping from Indeed view job listing page
            jobTitle = document.querySelector('.jobsearch-JobInfoHeader-title-container .jobsearch-JobInfoHeader-title')?.textContent.trim() || "";
            company = document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent.trim() || "";
            unknownInput = "Indeed";
            applicationDateTime = getCurrentDateTimeFormatted();
            url = pageUrl; // Set to the current page URL
        }
        else if (pageUrl.startsWith("https://www.glassdoor.com/Job/")) {
            // Scraping from Glassdoor job page
            jobTitle = document.querySelector('.JobDetails_jobTitle__Rw_gn')?.textContent.trim() || "";
            company = document.querySelector('.EmployerProfile_employerName__Xemli')?.textContent.trim() || "";
            unknownInput = "GlassDoor";
            applicationDateTime = getCurrentDateTimeFormatted();
            url = 'N/A'; // Set to 'N/A' as per your requirement
        }
        else if (pageUrl.startsWith("https://www.glassdoor.com/job-listing/")) {
            // Scraping from Glassdoor job listing page
            jobTitle = document.querySelector('h1.JobDetails_jobTitle__Rw_gn')?.textContent.trim() || "";
            company = document.querySelector('span.EmployerProfile_employerName__Xemli')?.textContent.trim() || "";
            unknownInput = "GlassDoor";
            applicationDateTime = getCurrentDateTimeFormatted();
            url = pageUrl; // Set to the current page URL
        }

        // Store data in Chrome's local storage and send response
        chrome.storage.local.set({ jobTitle, company, unknownInput, applicationDateTime, url }, function() {
            sendResponse({ jobTitle, company, unknownInput, applicationDateTime, url });
        });

        return true; // Indicates that the response is asynchronous
    }
});



/* LINKEDIN SEARCH FEATURE: auto-remove previously applied to jobs from search results  */

function removePrevAppliedFromSearchResults(prevApplied) {
    // select all search results and iterate through them
    var companies = document.querySelectorAll('span.job-card-container__primary-description');
    Array.from(companies).map(company => {
        var companyName = company.textContent.trim() || "";
        var jobTitle = company.parentNode.parentNode.querySelector('div > a.job-card-list__title > strong').textContent.trim() || "";
        // remove search result if we have already applied for that job title at that company
        if (companyName in prevApplied && prevApplied[companyName].includes(jobTitle)) {
            var companyContainer = company.closest('div.job-card-container');
            companyContainer.remove();
        }
    });
};




/* LINKEDIN SEARCH FEATURE: auto-send data to google spreadsheet on EasyApply submit */

var applyBTN;

function listenForApply() {
    applyBTN = document.querySelector('button.jobs-apply-button');
    if (applyBTN) applyBTN.addEventListener('click', applyBtnListener);

}

function applyBtnListener() {
    applyBTN.removeEventListener('click', applyBtnListener);

    document.body.addEventListener('click', searchForSubmitBTN);
}

var submitBTN;

function searchForSubmitBTN() {
    submitBTN = document.querySelector('[aria-label="Submit application"]') || null
    if (submitBTN) {
        addSubmitBtnListener(submitBTN);
    } else {
        var nextBTN = document.querySelector('[aria-label="Continue to next step"]') || null;
        var reviewBTN = document.querySelector('[aria-label="Review your application"]') || null;
        var preApplyBTN = document.querySelector('button.job-details-pre-apply-safety-tips-modal__review-button') || null;
        console.log('nxtbtn', nextBTN, 'reviewbtn', reviewBTN, 'preApplyBTN', preApplyBTN);
        if (!nextBTN && !reviewBTN && !preApplyBTN) {
            document.body.removeEventListener('click', searchForSubmitBTN);
            return;
        }
    }
}

function addSubmitBtnListener() {
    submitBTN.removeEventListener('click', submitClick);
    submitBTN.addEventListener('click', submitClick);

}



function submitClick() {
    document.body.removeEventListener('click', searchForSubmitBTN);
    submitBTN.removeEventListener('click', submitClick);
    sendApplyData();
}



function sendApplyData() {
    chrome.runtime.sendMessage('appSubmitted', function(response) {
        console.log('response', response)
    })
}