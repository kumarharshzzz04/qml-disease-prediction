import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

/*
  Patient data entry form with all 13 features.
  Emits predictRequested signal with the data object when Predict button is clicked.
*/

Rectangle {
    id: root
    border.color: "#ccc"
    border.width: 1
    radius: 8
    color: "#f8f8f8"

    property var patientData: ({})

    signal predictRequested(var data)

    function collectData() {
        var data = {
            "age": ageField.text,
            "sex": sexCombo.currentIndex,  // 0 or 1
            "cp": cpCombo.currentIndex + 1,
            "trestbps": trestbpsField.text,
            "chol": cholField.text,
            "fbs": fbsCombo.currentIndex,
            "restecg": restecgCombo.currentIndex,
            "thalach": thalachField.text,
            "exang": exangCombo.currentIndex,
            "oldpeak": oldpeakField.text,
            "slope": slopeCombo.currentIndex + 1,
            "ca": caCombo.currentIndex,
            "thal": thalCombo.currentIndex
        }
        data.age = Number(data.age)
        data.trestbps = Number(data.trestbps)
        data.chol = Number(data.chol)
        data.thalach = Number(data.thalach)
        data.oldpeak = Number(data.oldpeak)
        // thal mapping: combo index 0->3, 1->6, 2->7
        var thalMap = [3, 6, 7]
        data.thal = thalMap[data.thal]
        return data
    }

    ScrollView {
        id: formScroll
        anchors.fill: parent
        anchors.margins: 15
        ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

        ColumnLayout {
            width: formScroll.availableWidth
            spacing: 8

        Text {
            text: "Patient Information"
            font.bold: true
            font.pixelSize: 18
        }

        GridLayout {
            columns: 2
            rowSpacing: 5
            columnSpacing: 10
            Layout.fillWidth: true

            // Age
            Label { text: "Age" }
            TextField { id: ageField; placeholderText: "e.g. 63"; Layout.fillWidth: true }

            // Sex
            Label { text: "Sex" }
            ComboBox {
                id: sexCombo
                model: ["Female", "Male"]
                currentIndex: 1
                Layout.fillWidth: true
            }

            // Chest pain type
            Label { text: "Chest Pain (cp)" }
            ComboBox {
                id: cpCombo
                model: ["Typical angina", "Atypical angina", "Non-anginal pain", "Asymptomatic"]
                currentIndex: 0
                Layout.fillWidth: true
            }

            // Resting BP
            Label { text: "Resting BP (mm Hg)" }
            TextField { id: trestbpsField; placeholderText: "e.g. 145"; Layout.fillWidth: true }

            // Cholesterol
            Label { text: "Cholesterol (mg/dl)" }
            TextField { id: cholField; placeholderText: "e.g. 233"; Layout.fillWidth: true }

            // Fasting blood sugar
            Label { text: "FBS > 120 mg/dl" }
            ComboBox {
                id: fbsCombo
                model: ["False", "True"]
                currentIndex: 0
                Layout.fillWidth: true
            }

            // Resting ECG
            Label { text: "Resting ECG" }
            ComboBox {
                id: restecgCombo
                model: ["Normal", "ST-T wave abnormality", "Left ventricular hypertrophy"]
                currentIndex: 0
                Layout.fillWidth: true
            }

            // Max heart rate
            Label { text: "Max Heart Rate" }
            TextField { id: thalachField; placeholderText: "e.g. 150"; Layout.fillWidth: true }

            // Exercise induced angina
            Label { text: "Exercise Angina" }
            ComboBox {
                id: exangCombo
                model: ["No", "Yes"]
                currentIndex: 0
                Layout.fillWidth: true
            }

            // ST depression
            Label { text: "ST Depression (oldpeak)" }
            TextField { id: oldpeakField; placeholderText: "e.g. 2.3"; Layout.fillWidth: true }

            // Slope
            Label { text: "Slope" }
            ComboBox {
                id: slopeCombo
                model: ["Upsloping", "Flat", "Downsloping"]
                currentIndex: 0
                Layout.fillWidth: true
            }

            // Number of vessels
            Label { text: "Vessels (ca)" }
            ComboBox {
                id: caCombo
                model: ["0", "1", "2", "3"]
                currentIndex: 0
                Layout.fillWidth: true
            }

            // Thalassemia
            Label { text: "Thalassemia" }
            ComboBox {
                id: thalCombo
                model: ["Normal", "Fixed Defect", "Reversible Defect"]
                currentIndex: 0
                Layout.fillWidth: true
            }
        }

        Button {
            text: "Predict Disease Risk"
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 10
            onClicked: {
                var data = collectData()
                root.patientData = data
                predictRequested(data)
            }
        }
    }
    }
}
