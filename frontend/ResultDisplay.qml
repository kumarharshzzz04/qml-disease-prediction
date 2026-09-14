import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

/*
  Displays prediction results with explainability features.
  Shows probability, risk level, recommendation, and top contributing features.
*/

Rectangle {
    id: root
    border.color: "#ccc"
    border.width: 1
    radius: 8
    color: "white"

    property real probability: 0.0
    property string risk: "Low"
    property string recommendation: ""
    property var featureImportance: []  // Array of {feature, importance}

    visible: false

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 5

        Text {
            text: "Prediction Result"
            font.bold: true
            font.pixelSize: 16
        }

        // Main result panel
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 120
            color: "#f8f9fa"
            radius: 8
            border.color: "#e0e0e0"

            RowLayout {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 20

                // Left: Probability + Gauge
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 5

                    Text {
                        text: "Probability"
                        font.pixelSize: 12
                        color: "#666"
                    }

                    // Gauge
                    Rectangle {
                        width: 150
                        height: 20
                        border.color: "#333"
                        border.width: 1
                        radius: 10
                        clip: true
                        Layout.fillWidth: true

                        Rectangle {
                            width: parent.width * (root.probability >= 0 ? root.probability : 0)
                            height: parent.height
                            color: {
                                if (root.probability < 0.3) return "#28a745"  // green
                                else if (root.probability < 0.7) return "#fd7e14"  // orange
                                else return "#dc3545"  // red
                            }
                            radius: 10
                        }
                    }

                    Text {
                        text: root.probability >= 0 ? (root.probability * 100).toFixed(1) + "%" : "N/A"
                        font.bold: true
                        font.pixelSize: 20
                    }
                }

                // Right: Risk + Recommendation
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 3

                    RowLayout {
                        spacing: 10
                        Text { text: "Risk Level:"; font.bold: true; font.pixelSize: 14 }
                        Text {
                            text: root.risk
                            color: {
                                if (root.risk === "Low") return "#28a745"
                                else if (root.risk === "Moderate") return "#fd7e14"
                                else if (root.risk === "High") return "#dc3545"
                                else return "black"
                            }
                            font.bold: true
                            font.pixelSize: 16
                        }
                    }

                    Text {
                        text: root.recommendation
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                        color: "#333"
                        font.italic: true
                        font.pixelSize: 12
                    }
                }
            }
        }

        // Explainability section
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 180
            color: "#f8f9fa"
            radius: 8
            border.color: "#e0e0e0"
            visible: root.featureImportance.length > 0

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 5

                Text {
                    text: "Key Contributing Features"
                    font.bold: true
                    font.pixelSize: 13
                    color: "#333"
                }

                // Feature importance bars
                Repeater {
                    model: root.featureImportance

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 22
                        color: "white"
                        radius: 4

                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: 3
                            spacing: 10

                            Text {
                                text: modelData.feature
                                Layout.preferredWidth: 120   // fixed label column -> all bars start at the same x
                                Layout.fillWidth: false
                                elide: Text.ElideRight
                                font.pixelSize: 11
                                color: "#333"
                                horizontalAlignment: Text.AlignRight
                            }

                            Rectangle {
                                objectName: "barTrack"
                                Layout.fillWidth: true
                                Layout.preferredHeight: 16
                                color: "#e9ecef"
                                radius: 8
                                clip: true

                                Rectangle {
                                    width: parent.width * (modelData.importance / 0.8)  // scale for visibility
                                    height: parent.height
                                    color: "#4d6bfe"
                                    radius: 8
                                }
                            }

                            Text {
                                text: (modelData.importance * 100).toFixed(1) + "%"
                                font.pixelSize: 10
                                color: "#555"
                                Layout.preferredWidth: 40
                            }
                        }
                    }
                }
            }
        }
    }
}
