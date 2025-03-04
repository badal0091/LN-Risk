let token;
window.onload = async function() {
  try {
    const response = await fetch("https://llmfoundry.straive.com/token", {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`); // Handle non-200 responses
    }

    const data = await response.json();

    if (data && data.token) {
      token = data.token;
    } else {
      token = null;
      console.warn("Token not found in response:", data); // Log the response for debugging
    }

  } catch (error) {
    token = null;
    console.error("Error fetching token:", error); // Log the error for debugging
  }
};

document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("fileInput");
    const uploadBox = document.getElementById("drop-area");
    const uploadBtn = document.getElementById("uploadBtn");
    const previewFrame = document.getElementById("preview");
    const extractText = document.getElementById("extract-text");
    const extractBox = document.getElementById("extract-box");
    const uploadContainer = document.getElementById("uploadContainer");
    const navPanel = document.getElementById("nav-panel");
    const downloadButton = document.getElementById("downloadButton"); // Get the download button

    const systemPrompt = `You are a document analysis assistant. Your task is to thoroughly examine the provided documents' content, including any information from images, and perform all checks as outlined below.

-----document start----- and -----document end----- indicate the start and end of document content. Multiple start and end points mean there are multiple documents.

Instructions for all checks:

Perform these checks for each document separately and provide details in distinct sections per document.
Do not miss any check; all checks must be thoroughly performed.
Include information from both text and images in your analysis.
For each document, retrieve the following details (if not present, omit the field):

Document Type: Document File Name:

Consumer Complaint Letter: Document File Name, Full Name, Email, Address, City, State, Zip, POBox, Phone, Fax, Email, Date of Letter, DOB, SSN, Bankruptcy chapter, Case number, Summary, Action Items.
CFPB: Document File Name, Consumer Complaint ID, Full Name, Email Address, Area Code, Phone, Address, Product or Service, Consumer Identified Company, Name, DOB, Social Security Number (Last Four), Issue, Desired Resolution, Complaint status, Sent to Company, Due Date, Summary, Action Items.
BBB (Better Business Bureau): Document File Name, Complaint ID, Date Filed, Letter Written To, Letter Written From, Address, Phone, BBB Complaint Analyst, Name, Address, Phone, Email ID, Complaint Involves, Customer's Statement of the Problem, Desired Settlement, Summary, Action Items.
Driver License: Document File Name, Driver License Number, State, Name, Address, Expiration Date, Date of Birth.
SSN: Document File Name, SSN Number, Name.
Passport: Document File Name, Passport Number, Name, Nationality, DOB, Place of Birth, Date Of Issue, Expiration date.
Attorney General : Document File Name, Submission ID, Full Name, Area Code, Phone Number, Email, Address, City, State, Zip, Name of Consumer, Company Name, Company Website, Desired Resolution, Comment Or Question Message, Summary, Action Item.
DEPARTMENT OF JUSTICE: Complaint ID, PIU, From details (Full Name, Area code, Phone, Email Address, Address, City, State, Zip code), To details (P.O. Box, Phone, E-mail, Fax), Name of the consumer, Staff.
Case Summary: Complaint ID, Date filed, Case number, Chapter Number, Bankruptcy disposition, Date reported, Court number/name, Current disposition date, Date verified, Prior disposition.
Any other relevant document types and their specific fields
Ensure the following:

Extract all relevant information from both text and images in each document.
For each document, summarize the content, including information from images.
Provide action items based on each document's content.
No duplicate entries in the output.
Display only available fields (omit placeholders for missing details).
For Driver License, Social Security, or SSN documents, provide the extracted information without summary or action items.
 Ensure the following:
    - **For each document**, summarize the content of the letter.
    - **Action items** should be provided based on each document’s content.
    - No duplicate entries are present in the output.
    - Display only available fields (if details are missing, do not include placeholders like "Not provided").
**Format of the output:**
    ### Document 1 (Document Type: <Type>)
    Provide all the extracted details here in bullet points.
    - **Summary of Document 1:**
    Should highlight/identify what the consumer is stating is wrong and wants to dispute.  The dispute should always pertain to LexisNexis. If the consumer mentions contacting LexisNexis previously and provides a specific date or time frame, this should be captured. Also, if the complaint mentions, any of the following examples: bankruptcy, criminal record, ID theft, fraud, etc. It should be captured as part of the summary. If specific detailed information is provided about the account (i.e. bankruptcy chapter 7 or 13 – case number 123456) the specific information should be listed as well.
    - **Action Items for LexisNexis agent**
    o    Actions should always pertain to LexisNexis representative.
    o    Investigate the items outlined in the complaint and verify for accuracy. 
    o    Respond to regulatory agency by specific due date provided. 
    o    Ensure that the response is factual and does not create liability.

    ### Document 2 (Document Type: <Type>)
    Provide all the extracted details here in bullet points.
    - **Summary of Document 2:**
    Should highlight/identify what the consumer is stating is wrong and wants to dispute.  The dispute should always pertain to LexisNexis. If the consumer mentions contacting LexisNexis previously and provides a specific date or time frame, this should be captured. Also, if the complaint mentions, any of the following examples: bankruptcy, criminal record, ID theft, fraud, etc. It should be captured as part of the summary. If specific detailed information is provided about the account (i.e. bankruptcy chapter 7 or 13 – case number 123456) the specific information should be listed as well.
    - **Action Items for LexisNexis agent**
    o    Actions should always pertain to LexisNexis representative.
    o    Investigate the items outlined in the complaint and verify for accuracy. 
    o    Respond to regulatory agency by specific due date provided. 
    o    Ensure that the response is factual and does not create liability.
    ...

    ### Final Consolidated Summary
    Provide a final eloberate summary here, consolidating all the unique information from the documents.

    ### Final Items for LexisNexis agent
    o    Perform thorough investigation into consumers disputes.
    o    AI provides specific items consumer is disputing for agent if provided and or provided keyword(s) disputed.
    o    AI provides due date that agent should respond back to agency by.  
    o    Identify any additional requests from consumer such as provide proof of my signature. How did you verify my record?
    o    If consumer mentions any escalation path such as litigation and or regulatory agency, please add this.

     Additional Requirements-
    1. If Document Type if Driving License or Social Security or SSN - Don't do summary or Consolidated Summary or Items for LexisNexis agent and action items for these individual documents.
    2. For each key:value give respons like **key**:value.
`;


    // Data Store for Uploaded Documents
    const documents = [];

    // File Upload Click
    uploadBtn.addEventListener("click", () => fileInput.click());

    // File Upload via Drag and Drop
    uploadBox.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadBox.style.border = "2px solid #007bff";
    });

    uploadBox.addEventListener("dragleave", () => {
        uploadBox.style.border = "2px dashed #58c7e2";
    });

    uploadBox.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadBox.style.border = "2px dashed #58c7e2";
        const files = Array.from(e.dataTransfer.files);
        handleFilesUpload(files);
    });

    fileInput.addEventListener("change", (e) => {
        const files = Array.from(e.target.files);
        handleFilesUpload(files);
    });

    // Function to update UI when files are uploaded
    function updateUploadUI(files) {
        // Optionally, you can show thumbnails or file names here
        // For simplicity, we'll just reset the upload box
        uploadContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-radius: 8px; background: white;">
                <h3 style="margin: 0;">Upload Your Files</h3>
                <button id="reuploadBtn" style="background: #58c7e2; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
                    Upload More Files
                </button>
            </div>
        `;

        // Re-upload button event
        document.getElementById("reuploadBtn").addEventListener("click", () => fileInput.click());
    }

    // Handle multiple file uploads
    function handleFilesUpload(files) {
        if (files.length === 0) return;

        updateUploadUI(files);

        files.forEach((file) => {
            if (file.type === "application/pdf") {
                extractTextFromPDF(file);
            } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                extractTextFromDOCX(file);
            } else if (file.type.startsWith("image/")) {
                extractTextFromImage(file);
            } else {
                alert(`Unsupported file type: ${file.type}`);
            }
        });
    }

    // Function to extract text from PDF
    async function extractTextFromPDF(file) {
        try {
            const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
            let doc_content = "";
            let images = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(" ");
                doc_content += pageText + "\n";

                // Render page to an image for OCR
                const scale = 2; // High resolution for better OCR accuracy
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };

                await page.render(renderContext).promise;
                images.push(canvas.toDataURL("image/png")); // Convert canvas to base64 image
            }

            // Perform OCR using LLM API
            const ocrTexts = await extractTextFromImages(images);
            doc_content += "\n" + ocrTexts.join("\n");

            // Send all extracted text and images for processing
            const extractedData = await sendToLLM(file.name, file.name+doc_content, images);

            if (extractedData) {
                addDocument(file.name, "PDF", extractedData, images, file);
            }
        } catch (error) {
            console.error("Error extracting PDF:", error);
            alert(`Error processing PDF file: ${file.name}`);
        }
    }

    // Function to extract text from DOCX
    function extractTextFromDOCX(file) {
        const reader = new FileReader();
        reader.onload = async function (event) {
            try {
                const arrayBuffer = event.target.result;
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                const doc_content = result.value;
                const extractedData = await sendToLLM(file.name, file.name+doc_content);

                if (extractedData) {
                    addDocument(file.name, "DOCX", extractedData, [], file);
                }
            } catch (err) {
                console.error(err);
                alert(`Error extracting text from DOCX file: ${file.name}`);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // Function to extract text from Image using Tesseract.js
    async function extractTextFromImage(file) {
        try {
            const reader = new FileReader();
            reader.onload = async function (event) {
                const imageData = event.target.result;
                const { data: { text } } = await Tesseract.recognize(imageData, "eng");
                const doc_content = text.trim();
                const extractedData = await sendToLLM(file.name, file.name+doc_content);

                if (extractedData) {
                    addDocument(file.name, "Image", extractedData, [imageData], file);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error extracting image:", error);
            alert(`Error processing image file: ${file.name}`);
        }
    }

    // Function to perform OCR on images extracted from PDF
    async function extractTextFromImages(images) {
        extractText.innerHTML = "Analyzing document..."; // Show status in UI
        const apiEndpoint = "https://llmfoundry.straive.com/gemini/v1beta/openai/chat/completions";

        let ocrResults = [];

        for (const img of images) {
            const base64Image = img.split(",")[1]; // Remove the "data:image/png;base64," part

            const body = {
                model: "gemini-exp-1206",
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: "Extract information from this image and return it as JSON. Values must be scalars. Even if you cannot process the image, try to get information from it."
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: { url: `data:image/png;base64,${base64Image}` }
                            }
                        ]
                    }
                ]
            };

            try {
                const response = await fetch(apiEndpoint, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}:my-test-project`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body)
                });

                const responseData = await response.json();
                const extractedText = responseData.choices?.[0]?.message?.content || "";
                ocrResults.push(extractedText);
            } catch (error) {
                console.error("Error processing OCR:", error);
                ocrResults.push(""); // In case of an error, return an empty string
            }
        }

        return ocrResults;
    }

    // Function to send extracted content to LLM and get processed data
    async function sendToLLM(fileName, docContent, images = []) {
        if (!docContent.trim() && images.length === 0) {
            alert(`No extractable text or images found in ${fileName}!`);
            return null;
        }

        extractText.innerHTML = `Analyzing "${fileName}"...`;

        try {
            const response = await fetch("https://llmfoundry.straive.com/gemini/v1beta/openai/chat/completions ", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}:ln-consumers-complaint`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gemini-2.0-flash",
                    messages: [
                        { role: "user", content: systemPrompt+docContent },
                    ]
                })
            });

            const data = await response.json();
            const extractedData = data.choices[0].message.content;

            // Optionally, you can parse the JSON if response_format was JSON
            // const parsedData = JSON.parse(extractedData);
            // return parsedData;

            return extractedData; // Assuming the response is a string in desired format
        } catch (error) {
            extractText.innerHTML = `Error analyzing "${fileName}".`;
            console.error(error);
            alert(`Error analyzing "${fileName}".`);
            return null;
        }
    }

    

    // Function to add a document to the data store and update UI
    async function addDocument(fileName, docType, extractedData, images, file) {
        const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // const response = await fetch("https://llmfoundry.straive.com/openai/v1/chat/completions", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}:doc-type` },
        //     body: JSON.stringify({
        //       model: "gpt-4o-mini",
        //       messages: [{ role: "user", content: "You are a document analysis assistant. Your task is to thoroughly examine the provided documents and provide only the document type from list of documents- {Consumer Complaint Letter, CFPB, BBB (Better Business Bureau), Driver License, SSN, Passport, Attorney General, DEPARTMENT OF JUSTICE}" + extractedData }],
        //     }),
        //   });

        // const data = await response.json();
        // docType = data.choices[0].message.content;
          
        const docItem = {
            id: docId,
            name: fileName,
            type: docType,
            data: extractedData,
            images: images,
            file: file
        };
        documents.push(docItem);
        addNavItem(docItem);
        if (documents.length === 1) {
            displayDocument(docItem.id);
        }
    }

    // Function to add a navigation item
    function addNavItem(docItem) {
        const navItem = document.createElement("div"); // Now refers to the global document
        navItem.classList.add("nav-item");
        navItem.setAttribute("data-id", docItem.id);
        navItem.textContent = `${docItem.name}`;

        navItem.addEventListener("click", () => {
            // Remove active class from all nav items
            document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
            // Add active class to the clicked nav item
            navItem.classList.add("active");
            // Display the selected document
            displayDocument(docItem.id);
        });

        navPanel.appendChild(navItem);
    }

    // Function to display a document's extracted data
    function displayDocument(docId) {
        const docItem = documents.find(doc => doc.id === docId);
        if (!docItem) return;

        // Highlight the active nav item
        document.querySelectorAll(".nav-item").forEach(item => {
            if (item.getAttribute("data-id") === docId) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        // Parse the extracted data (assuming it's in the specified format)
        const parsedData = parseExtractedData(docItem.data);

        // Update the extract box with parsed data
        createStyledPanel(parsedData);

        // Optionally, show a preview if it's a PDF or Image
        if (docItem.type === "PDF") {
            const fileURL = URL.createObjectURL(docItem.file);
            previewFrame.src = fileURL;
            previewFrame.hidden = false;
        } else if (docItem.type === "Image") {
            // For images, you can display the image directly or handle as needed
            previewFrame.src = docItem.images[0];
            previewFrame.hidden = false;
        } else {
            previewFrame.hidden = true;
        }
    }

    // Function to parse the extracted data into key-value pairs
    function parseExtractedData(extractedData) {
        // const lines = extractedData.split('\n').filter(line => line.trim() !== "");
        // const dataObject = {};

        // lines.forEach(line => {
        //     const separatorIndex = line.indexOf(':');
        //     if (separatorIndex !== -1) {
        //         const key = line.substring(0, separatorIndex).trim();
        //         const value = line.substring(separatorIndex + 1).trim();
        //         if (key && value) {
        //             dataObject[key] = value;
        //         }
        //     }
        // });
        const html_con =  marked.parse(extractedData.replace(/\n/g, "  \n").replace(/\bo\s+/g, "- "))
        return html_con;
    }

    // Function to create a styled panel from the parsed data
    function createStyledPanel(data) {
        // let panelHTML = '<div style="display: flex; flex-direction: column; gap: 10px;">';

        // for (const key in data) {
        //     panelHTML += `
        //         <div style="display: flex; justify-content: space-between; align-items: center;">
        //             <span style="font-weight: bold; color: #333; width: 40%; text-align: left;">${key.replace(/-/g, ' ')}</span>
        //             <span style="color: #555; width: 58%; text-align: left; word-break: break-word; background: #f9f9f9; border: 1px solid #ddd; border-radius: 5px; padding: 12px;">${data[key]}</span>
        //         </div>
        //     `;
        // }

        // panelHTML += '</div>';

        // Replace the extract box content
        extractBox.innerHTML = data;
    }

    // Add event listener to the download button
    downloadButton.addEventListener("click", () => {
        generateDocFile();
    });
      // Function to generate and download the .doc file
     function generateDocFile() {
        if (documents.length === 0) {
            alert("No documents have been uploaded.");
            return;
        }

        let docContent = "";
        documents.forEach((doc, index) => {
            docContent += `File Name: ${doc.name}\n`;
            // Get the text content from the extractBox for each document
            const extractedText = getTextFromExtractBox();
            docContent += extractedText + "\n\n"; // Append the extracted text
        });

        // Create a Blob with the .doc content
        const blob = new Blob([docContent], { type: "application/msword" });

        // Create a download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "extracted_data.doc"; // Set the filename
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up
    }

    // Function to extract text content from the extractBox
    function getTextFromExtractBox() {
        // Get all the text content from the extractBox element
        return extractBox.textContent || extractBox.innerText || "";
    }
});