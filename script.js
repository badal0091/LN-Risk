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
    //   console.log(token);
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
    const consolidatedSummaryButton = document.getElementById("consolidatedSummaryButton");
    const percentageindicator = document.getElementById("percentage-indicator");

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
        // Optionally, you can show thumbnails or file names here. for simplicity, we'll just reset the upload box
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

    let filesProcessed = 0;
    let totalFiles = 0;

    function handleFilesUpload(files) {
        if (files.length === 0) return;

        updateUploadUI(files);
        totalFiles = files.length; // Set the total number of files
        filesProcessed = 0; // Reset the counter

        files.forEach((file) => {
            if (file.type === "application/pdf") {
                extractTextFromPDF(file);
            } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                extractTextFromDOCX(file);
            } else if (file.type.startsWith("image/")) {
                extractTextFromImage(file);
            } else {
                alert(`Unsupported file type: ${file.type}`);
                filesProcessed++; // Increment even on error to avoid getting stuck
                checkIfAllFilesProcessed();
            }
        });
    }

    // Modify extractTextFromPDF, extractTextFromDOCX, extractTextFromImage to call checkIfAllFilesProcessed after processing
    async function extractTextFromPDF(file) {
        extractText.innerHTML = "Analyzing document..."; // Show status in UI
        try {
            const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
            if (pdf.numPages <= 5){
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
                const extractedData = await sendToLLM(file.name, file.name+doc_content, images, "PDF");

                if (extractedData) {
                    addDocument(file.name, "PDF", extractedData, images, file, doc_content);
                }
            }
            else{
                const reader = new FileReader();
                reader.onload = async function (event) {
                    const base64_pdf = btoa(event.target.result); // Convert to Base64
                    const body = {
                        model: "gemini-2.0-flash",
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
                                        image_url: { url: `data:application/pdf;base64,${base64_pdf}` }
                                    }
                                ]
                            }
                        ]
                    };
            
                    const response = await fetch("https://llmfoundry.straive.com/gemini/v1beta/openai/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${token}:big-doc-analysis-ln-risk`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(body)
                    });
    
                    const responseData = await response.json();
                    const extractedText = responseData.choices?.[0]?.message?.content || "";
                    // console.log(extractText);
                    // Send all extracted text and images for processing
                    const extractedData = await sendToLLM(file.name, file.name+extractedText, [], "PDF");

                    if (extractedData) {
                        addDocument(file.name, "PDF", extractedData, [], file, doc_content);
                    }    
                };
                reader.readAsBinaryString(file); 
            }    
        } catch (error) {
            console.error("Error extracting PDF:", error);
            alert(`Error processing PDF file: ${file.name}`);
        } finally {
            filesProcessed++;
            checkIfAllFilesProcessed();
        }
    }

    function extractTextFromDOCX(file) {
        const reader = new FileReader();
        reader.onload = async function (event) {
            try {
                const arrayBuffer = event.target.result;
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                const doc_content = result.value;
                const extractedData = await sendToLLM(file.name, file.name+doc_content, [], "DOCX");

                if (extractedData) {
                    addDocument(file.name, "DOCX", extractedData, [], file, doc_content);
                }
            } catch (err) {
                console.error(err);
                alert(`Error extracting text from DOCX file: ${file.name}`);
            } finally {
                filesProcessed++;
                checkIfAllFilesProcessed();
            }
        };
        reader.readAsArrayBuffer(file);
    }

    async function extractTextFromImage(file) {
        try {
            const reader = new FileReader();
            reader.onload = async function (event) {
                const imageData = event.target.result;
                const { data: { text } } = await Tesseract.recognize(imageData, "eng");
                const doc_content = text.trim();
                const extractedData= await sendToLLM(file.name, file.name+doc_content, [imageData], "Image");

                if (extractedData) {
                    addDocument(file.name, "Image", extractedData, [imageData], file, doc_content);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error extracting image:", error);
            alert(`Error processing image file: ${file.name}`);
        } finally {
            filesProcessed++;
            checkIfAllFilesProcessed();
        }
    }

    function checkIfAllFilesProcessed() {
        if (filesProcessed === totalFiles) {
            percentageindicator.style.display = "inline-block"; // Show the button
        }
    }

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

    const systemPromptForType = `You are a document classification expert. Please read the document and identify all the document types present in the content.
        -----document start----- and -----document end----- indicates the start of document content and end of document , if content contains multiple start and end point means it has multiple documents
    Document types are: CFPB, Consumer Letter, BBB, Driver License, SSN, Attorney General, Passport, Gas Bill, DEPARTMENT OF JUSTICE, Case Summary and Other Letters.
    Return the document types in a comma-separated list. If no document type can be determined, return "Other Letters".`;

    async function sendToLLM(fileName, docContent, images = [], docType) {
        if (!docContent.trim() && images.length === 0) {
            alert(`No extractable text or images found in ${fileName}!`);
            return {extractedData: null, accuracy: null};
        }

        extractText.innerHTML = `Identifying document type for "${fileName}"...`;

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
                        { role: "user", content: systemPromptForType + docContent },
                    ]
                })
            });

            const data = await response.json();
            const documentTypes = data.choices[0].message.content;
            const geminiExtraction = await extractDataBasedOnType(fileName, docContent, documentTypes);

            const final_data = await compareLLMResults(geminiExtraction, documentTypes+docContent);

            return final_data;
            
        } catch (error) {
            extractText.innerHTML = `Error identifying document type for "${fileName}".`;
            console.error(error);
            alert(`Error identifying document type for "${fileName}".`);
            return null;
        }
    }

    const systemPromptForExtraction = `You are a customer care Analyst who is going through the Complaint letters received from the consumer side.
    1. Please read the document and create the Summary and Action items for Customer care Analyst to investigate the issue raised by the customer. 
    2. Use the guideline provided to create both Summary and Action Items in bullet points. If any keywords are present in the document please take out the relevant information and mention the information in summary & action items as well and perform all checks as outlined below.
        -----document start----- and -----document end----- indicates the start of document content and end of document , if content contains multiple start and end point means it has multiple documents
        Instructions for all checks:
        - Perform these checks **for each document separately** and provide details in distinct sections per document. Also for each image present in the document.
        - Do not miss any check; all checks must be thoroughly performed.
        For each document, retrieve the following details (if not present, omit the field):
        **Document Type:** Always Provide the document type as CFPB, Consumer Letter, BBB, Driver License, SSN, Attorney General, Passport, Gas Bill and Other Letters.
        -CFPB: Document File Name, Consumer Complaint ID, Full Name, Email Address, Area Code, Phone, Address	Product or Service, Consumer Identified Company Name, DOB, Social Security Number (Last Four), Issue, Desired Resolution, Complaint status, Sent to Company, Due Date
        -Consumer Letter: Document File Name, Date of letter, Full Name, Email, Address, City, State, Zip, Agency Name, Agency Address Phone, Fax, Email , Date of Letter, DOB, SSN, Bankruptcy chapter, Case number
        -BBB: Document File Name, Complaint ID, Date Filed, Letter Written To, Letter Written From, Address, Phone, BBB Complaint Analyst, Name, Address, Phone, Email ID, Complaint Involves, Customer’s Statement of the Problem, Desired Settlement
        -Bank Statements: Document File Name, Full Name, Address, City, State, Zip , Statement Period, Phone Number
        -Driver License: Document File Name, Driver License Number, State, Name, Address, Expiration Date, Date of Birth
        -SSN: Document File Name, SSN Number, Full Name
        -Social Security: Document File Name, SSN Number, Name.
        -Attorney General: Document File Name, Submission ID, Full Name, Area Code, Phone Number, Email, Address, City, State, Zip, Name of Consumer, Company Name, Company Website, Desired Resolution, Comment Or Question Message
        -Passport: Document File Name, Passport Number, Name, Nationality, DOB, Place of Birth, Date Of Issue, Expiration date
        -Gas Bill: Document File Name, Full Name, Address, Bill Date, Billing date period
        -Other Letters: Document File Name, Full Name, Address, Date of letter, Agency Name, Agency Address, Bankruptcy Chapter, Case number.
        - DEPARTMENT OF JUSTICE: Document File Name, Complaint ID,PIU, From details (Full Name, Area code, Phone, Email Address, Address, City, State, Zip code), To details (P.O. Box, Phone, E-mail, Fax),Name of the consumer,Staff
        - Case Summary: Complaint ID,Date filed,Case number,Chaper Number, Bankruptcy disposition, Date reported, Court number/ name,current disposition date, Date verified, prior disposition
        Ensure the following:
        - **For each document**, summarize the content of the letter.
        - **Action items** should be provided based on each document’s content.
        - No duplicate entries are present in the output.
        - Display only available fields (if details are missing, do not include placeholders like "Not provided").

        
        ### Document 1: (<Document Type>)
        Provide all the extracted details here in bullet points including Summary and Action Items.
        **Summary of Document 1**:  Should highlight/identify what the consumer is stating is wrong and wants to dispute.  The dispute should always pertain to Company/Customer. If the consumer mentions contacting Company/Customer previously and provides a specific date or time frame, this should be captured. Also, if the complaint mentions, any of the following examples: bankruptcy, criminal record, ID theft, fraud, etc. It should be captured as part of the summary. If specific detailed information is provided about the account (i.e. bankruptcy chapter 7 or 13 – case number 123456) the specific information should be listed as well.
        **Action Items for Customer Care Agent**:
        o    Actions should always pertain to representative.
        o    Investigate the items outlined in the complaint and verify for accuracy. 
        o    Respond to regulatory agency by specific due date provided = dd/mm/yyyy. 
        o    Ensure that the response is factual and does not create liability.

        Additional Requirements-
        1. If Document Type if Driving License or Social Security or SSN or Gas Bill or Passport or Bank statements or Telephone Bills - Don't do summary and action items for these individual documents.
        2. For each key:value give response like **key**:value.
        3. Only Extract all the information that is given above instead of other.
        `;

    async function extractDataBasedOnType(fileName, docContent, documentType) {
        extractText.innerHTML = `Extracting data for "${fileName}" (Type: ${documentType})...`;

        try {
            const response = await fetch("https://llmfoundry.straive.com/gemini/v1beta/openai/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}:ln-consumers-extraction`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gemini-2.0-flash",
                    messages: [
                        { role: "user", content: `Using the guidelines provided in ${systemPromptForExtraction} for accurate extraction, Please extract information specific to ${documentType} from the following content: ${docContent}. 
                        Provide only JSON output without any additional text or comments-
                            {
                                Document Type: <Type>,
                                key-field 1: value 1,
                                key-field 2: value 2,
                                summary (if any): summary,
                                action item (if any): action item
                            },
                            {
                                Document Type: <Type>,
                                key-field 1: value 1,
                                key-field 2: value 2,
                                summary (if any): summary,
                                action item (if any): action item
                            }
                        Please Strictly follow the above output response format. If Document Type if Driving License or Social Security or SSN - Don't do summary and action items for these individual documents. 
                        `},
                    ]
                })
            });

            const data = await response.json();
            let extractedData = data.choices[0].message.content;
            extractedData = extractedData.replace(/```json|```/g, '').trim();

            const parsedData = JSON.parse(extractedData);
            // console.log("Extracted Data:", parsedData);
            return parsedData;
        } catch (error) {
            extractText.innerHTML = `Error extracting data for "${fileName}" (Type: ${documentType}).`;
            console.error(error);
            alert(`Error extracting data for "${fileName}" (Type: ${documentType}).`);
            return null;
        }
    }

    async function compareLLMResults(result, docContent) {
        extractText.innerHTML = "Analyzing document...";
        const prompt = `You are an expert in document extraction validation. Your task is to compare the extracted data with the actual document content.

            - The extracted data is presented as a JSON (result).
            - The original document content is presented as plain text (docContent).
            
            ### Task:
            1. Carefully compare each key-value pair in the result with the corresponding information in docContent.
            2. For each key:
                - If the extracted value is **correct**, mark it as **1**.
                - If the extracted value is **incorrect**, mark it as **0** and provide a comment explaining that the value does not match with the actual content. Also, suggest the correct value.
            3. Return a revised JSON object that includes:
                - The original key-value pair.
                - An **"is_correct"** field with a value of **1** or **0**.
                - A **"comment"** field if the value is incorrect, containing the reason for the mismatch and the correct value.

            ### Output Example:
            \`\`\`json
            [
                {
                    "Document Type": {
                            "value": "Driver License",
                            "is_correct": "1"
                        },
                    
                    "Document File Name": {
                            "value": "abc.pdf",
                            "is_correct": "1"
                        },
                        
                    "License Number": {
                        "value": "44541657",
                        "is_correct": "1"
                    },
                    "State": {
                        "value": "Texas",
                        "is_correct": "1"
                    },
                    "Name": {
                        "value": "EPHRIM DYLAN LEWIS",
                        "is_correct": "0",
                        "comment": "The current value does not match with the content. The correct value is 'Ephraim Dylan Lewis'."
                    }
                },

                {
                    "Document Type": {
                            "value": "SSN",
                            "is_correct": "1"
                        },
                    
                    "Document File Name": {
                            "value": "abc.pdf",
                            "is_correct": "1"
                        },
                        
                    "License Number": {
                        "value": "123 453",
                        "is_correct": "1"
                    }
                }
            ]
            \`\`\`
            strictly follow- Do not Provide the is_correct and comments for Summary of Document, Summary and Action Items for Customer Care Agent.
            Be objective and ensure accurate evaluation. Only return the formatted JSON output.`;
        try {
            const response = await fetch("https://llmfoundry.straive.com/gemini/v1beta/openai/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}:ln-consumers-compare`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gemini-2.0-flash",
                    messages: [
                        { role: "user", content: prompt },
                        { role: "user", content: `Extracted Data (result): ${JSON.stringify(result)}` },
                        { role: "user", content: `Original Document Content: ${docContent}` }
                    ]
                })

            });

            const data = await response.json();
            let extractedData = data.choices[0].message.content;
            extractedData = extractedData.replace(/```json|```/g, '').trim();

            const parsedData = JSON.parse(extractedData);
            // console.log("Extracted Data:", parsedData);
            return parsedData;
        } catch (error) {
            extractText.innerHTML = `Error in comparison.`;
            console.error(error);
            alert(`Error in comparison.`);
            return null;
        }
    }
    
    
    // Function to add a document to the data store and update UI
    async function addDocument(fileName, docType, extractedData, images, file, doc_content) {
        const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;          
        const docItem = {
            id: docId,
            name: fileName,
            type: docType,
            data: extractedData,
            images: images,
            file: file,
            content: doc_content
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

        // Update the extract box with parsed data
        createStyledPanel(docItem.data);

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

    // Function to create a styled panel from the extracted data
    function createStyledPanel(extractedData) {
        let panelHTML = '<div style="display: flex; flex-direction: column; gap: 20px;">';

        // Iterate through each document object in the array
        extractedData.forEach(doc => {
            panelHTML += `<div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">`; // Add a border around each document

            for (const key in doc) {
                if (doc.hasOwnProperty(key)) {
                    const valueObj = doc[key];
                    let value = valueObj.value;
                    const isCorrect = valueObj.is_correct;
                    const comment = valueObj.comment;

                    // Determine color based on accuracy
                    let correctnessIndicator = 'grey'; // Default if no accuracy
                    if (isCorrect === "1") {
                        correctnessIndicator = 'green'; // Green for correct
                    } else if (isCorrect === "0") {
                        correctnessIndicator = 'red'; // Red for incorrect
                    }

                    // Create a row for key-value pair
                    panelHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: bold; color: #333; width: 40%; text-align: left;">${key.replace(/-/g, ' ').replace(/\*/g, '')}</span>
                            <span style="color: #555; width: 58%; text-align: left; word-break: break-word; background: #f9f9f9; border: 1px solid #ddd; border-radius: 5px; padding: 12px;">${value}</span>
                            <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${correctnessIndicator}; display: inline-block; margin-left: 5px;"
                                  ${comment ? `title="${comment}"` : ''}></span>
                        </div>
                    `;
                }
            }
            panelHTML += `</div>`; // Close the border around each document
        });

        panelHTML += '</div>';
        extractBox.innerHTML = panelHTML; // Render into frontend
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
        let i=1;
        documents.forEach((doc) => {
            docContent += `File Name-${i}: ${doc.name}\n`;
            let data1 = doc.data;
            data1.forEach(docu => {
                for (const key in docu) {
                    if (docu.hasOwnProperty(key)) {
                        const valueObj = docu[key];
                        let value = valueObj.value;
                        docContent += `\n${key.replace(/-/g, ' ').replace(/\*/g, '')} : ${value}\n\n`; // Append the extracted text
                    }
                }
            });
            i = i+1;
        });

        // Add consolidated summary if available
        if (consolidatedSummary) {
            docContent += `Consolidated Summary:\n${consolidatedSummary}\n\n`;
        }

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

    
    // Variable to store consolidated summary
    let consolidatedSummary = "";

    // Update the consolidated summary button event listener
    consolidatedSummaryButton.addEventListener("click", async () => {
        // Get all extracted data
        let docContent = "";
        documents.forEach((doc) => {
            docContent += `File Name: ${doc.name}\n`;
            docContent += `Extracted Data:\n${doc.content}\n\n`; // Append the extracted text
        });
        const allExtractedData = docContent;

        // Show generating message in UI
        extractBox.innerHTML = "Generating consolidated summary...";

        // Send to LLM for consolidated summary
        consolidatedSummary = await getConsolidatedSummary(allExtractedData);

        // Display the consolidated result
        extractBox.innerHTML = marked.parse(consolidatedSummary);
    });


    const systemPrompt2 = `Generate a Final Consolidated Summary and Final Items for Customer Care agent based on the above documents. Ensure the following:
        Provide consolidated summary should be in bullet points in bullet points.
    
    ### Final Consolidated Summary
    Documents Present:
    Consumer Name:
    Address:
    SSN: 
   Provide a final elaborate summary here, consolidating all the unique information from the documents. Please provide the summary in bullet points.

    ### Final Items for Customer Care agent
    o    Perform thorough investigation into consumers disputes.
    o    AI provides specific items consumer is disputing for agent if provided and or provided keyword(s) disputed.
    o    AI provides due date that agent should respond back to agency by.  
    o    Identify any additional requests from consumer such as provide proof of my signature. How did you verify my record?
    o    If consumer mentions any escalation path such as litigation and or regulatory agency, please add this. `;

    async function getConsolidatedSummary(allExtractedData) {
        try {
            const response = await fetch("https://llmfoundry.straive.com/gemini/v1beta/openai/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}:ln-summary`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gemini-2.0-flash",
                    messages: [
                        { role: "user", content: systemPrompt2 + allExtractedData },
                    ]
                })
            });

            const data = await response.json();
            const consolidatedData = data.choices[0].message.content;
            extractText.innerHTML = "Consolidated summary generated.";
            return consolidatedData;
        } catch (error) {
            extractText.innerHTML = "Error generating consolidated summary.";
            console.error(error);
            alert("Error generating consolidated summary.");
            return "Error generating consolidated summary.";
        }
    }
});
