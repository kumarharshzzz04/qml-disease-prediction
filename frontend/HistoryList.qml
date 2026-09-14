import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

/*
  Displays a list of past predictions (date, risk, probability).
*/

Rectangle {
    id: root
    border.color: "#ccc"
    border.width: 1
    radius: 8
    color: "white"

    property alias model: historyView.model

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 5

        Text {
            text: "Prediction History"
            font.bold: true
            font.pixelSize: 14
        }

        ListView {
            id: historyView
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            delegate: Rectangle {
                width: parent.width
                height: 30
                color: (index % 2) ? "#f0f0f0" : "white"
                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 5
                    Text { text: model.date; Layout.preferredWidth: 120 }
                    Text {
                        text: model.risk
                        color: {
                            if (model.risk === "Low") return "green"
                            else if (model.risk === "Moderate") return "orange"
                            else return "red"
                        }
                        font.bold: true
                    }
                    Text { text: (model.probability * 100).toFixed(1) + "%" }
                }
            }
        }
    }
}
