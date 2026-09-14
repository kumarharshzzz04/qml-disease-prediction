import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import QtQuick.Dialogs 1.2

/*
  Main application window for the Hybrid Quantum-Classical Disease Predictor.
  Composes the patient form, result display, and history list.
  Includes explainability features.
*/

ApplicationWindow {
    visible: true
    width: 850
    height: 750
    title: "Hybrid Quantum Disease Predictor"

    // Model for prediction history
    ListModel {
        id: historyModel
    }

    // Store feature importance data
    property var featureImportanceData: []

    // Main layout: left column for form, right column for results/history
    RowLayout {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 15

        // Left: Patient Form
        PatientForm {
            id: patientForm
            Layout.fillHeight: true
            Layout.preferredWidth: parent.width * 0.5
            onPredictRequested: {
                predictionManager.predict(patientData)
            }
        }

        // Right: Results and History
        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 10

            ResultDisplay {
                id: resultDisplay
                Layout.fillWidth: true
                Layout.preferredHeight: 350
                visible: false
                featureImportance: featureImportanceData
            }

            // Dataset upload: batch-score a CSV of patients (delivery item 5)
            Button {
                id: batchButton
                Layout.fillWidth: true
                text: "Batch Score CSV..."
                onClicked: fileDialog.open()
            }

            HistoryList {
                id: historyList
                Layout.fillWidth: true
                Layout.fillHeight: true
                model: historyModel
            }
        }
    }

    // Dataset picker + batch result viewer
    FileDialog {
        id: fileDialog
        title: "Choose a patient CSV"
        nameFilters: ["CSV files (*.csv)", "All files (*)"]
        onAccepted: predictionManager.batchScore(fileUrl)
    }

    Dialog {
        id: batchDialog
        title: "Batch predictions"
        standardButtons: Dialog.Close
        width: 440
        height: 400
        TextArea {
            id: batchOutput
            anchors.fill: parent
            readOnly: true
            wrapMode: TextArea.Wrap
            font.family: "Consolas"
        }
    }

    // Manager to handle API calls and fetch feature importance
    QtObject {
        id: predictionManager

        property var backendUrl: "http://localhost:8000"

        function predict(patientData) {
            var json = JSON.stringify(patientData)

            var xhr = new XMLHttpRequest()
            xhr.open("POST", backendUrl + "/predict")
            xhr.setRequestHeader("Content-Type", "application/json")
            xhr.onreadystatechange = function() {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    if (xhr.status === 200) {
                        var response = JSON.parse(xhr.responseText)
                        // Update result display
                        resultDisplay.probability = response.probability
                        resultDisplay.risk = response.risk
                        resultDisplay.recommendation = response.recommendation
                        resultDisplay.visible = true

                        // Add to history
                        var historyEntry = {
                            "date": new Date().toLocaleString(),
                            "risk": response.risk,
                            "probability": response.probability
                        }
                        historyModel.insert(0, historyEntry)
                        if (historyModel.count > 10)
                            historyModel.remove(10)

                    } else {
                        resultDisplay.visible = true
                        resultDisplay.probability = -1
                        resultDisplay.risk = "Error"
                        resultDisplay.recommendation = "Could not reach server. Ensure backend is running."
                    }
                }
            }
            xhr.send(json)
        }

        // Dataset upload: read a local CSV and batch-score it via /predict/csv
        function batchScore(fileUrl) {
            var xhr = new XMLHttpRequest()
            xhr.open("GET", fileUrl)
            xhr.onreadystatechange = function() {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    // file:// reads may report status 0 in QML
                    if (xhr.status === 200 || xhr.status === 0) {
                        sendBatchCsv(xhr.responseText)
                    } else {
                        batchOutput.text = "Could not read file (status " + xhr.status + ")."
                        batchDialog.open()
                    }
                }
            }
            xhr.send()
        }

        function sendBatchCsv(csvText) {
            var boundary = "----QmlBatchBoundary" + Date.now()
            var body = "--" + boundary + "\r\n" +
                "Content-Disposition: form-data; name=\"file\"; filename=\"batch.csv\"\r\n" +
                "Content-Type: text/csv\r\n\r\n" +
                csvText + "\r\n--" + boundary + "--\r\n"
            var xhr = new XMLHttpRequest()
            xhr.open("POST", backendUrl + "/predict/csv")
            xhr.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + boundary)
            xhr.onreadystatechange = function() {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    if (xhr.status === 200) {
                        var r = JSON.parse(xhr.responseText)
                        var lines = "Model: " + r.model +
                            "\nTuned threshold: " + r.threshold +
                            "\nRows scored: " + r.n_rows + "\n\n"
                        for (var i = 0; i < r.predictions.length; i++) {
                            var p = r.predictions[i]
                            lines += "Row " + p.row + ": " +
                                (100 * p.probability).toFixed(1) + "%  " + p.risk + "\n"
                        }
                        batchOutput.text = lines
                        batchDialog.open()
                    } else {
                        batchOutput.text = "Batch scoring failed (" + xhr.status + "):\n" +
                            xhr.responseText
                        batchDialog.open()
                    }
                }
            }
            xhr.send(body)
        }

        // Fetch feature importance from backend on startup
        function fetchFeatureImportance() {
            var xhr = new XMLHttpRequest()
            xhr.open("GET", backendUrl + "/feature_importance")
            xhr.onreadystatechange = function() {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    if (xhr.status === 200) {
                        var data = JSON.parse(xhr.responseText)
                        featureImportanceData = data.features.map(function(f, i) {
                            return { "feature": f, "importance": data.importance[i] }
                        })
                    }
                }
            }
            xhr.send()
        }
    }

    // Load feature importance on startup
    Component.onCompleted: {
        predictionManager.fetchFeatureImportance()
    }
}
