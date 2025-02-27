import 'package:flutter/material.dart';


class Reason extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EndaTAO',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: ReasonForm(),
    );
  }
}

class ReasonForm extends StatefulWidget {
  @override
  _ReasonFormState createState() => _ReasonFormState();
}

class _ReasonFormState extends State<ReasonForm> {
  bool checkbox1 = false;
  bool checkbox2 = false;
  bool checkbox3 = false;

  void handleSubmit() {
    List<String> selectedReasons = [];
    if (checkbox1) selectedReasons.add("Reason 1");
    if (checkbox2) selectedReasons.add("Reason 2");
    if (checkbox3) selectedReasons.add("Reason 3");

    // Print selected options to console
    print("Selected Visit Reasons: $selectedReasons");

    // Show a confirmation message
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("[ ${selectedReasons.join(', ')} ]"),
        duration: Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Visit Reason',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Color(0xFF9FF5FF),
      ),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CheckboxListTile(
              title: Text("Reason 1"),
              value: checkbox1,
              onChanged: (bool? value) {
                setState(() {
                  checkbox1 = value!;
                });
              },
            ),
            CheckboxListTile(
              title: Text("Reason 2"),
              value: checkbox2,
              onChanged: (bool? value) {
                setState(() {
                  checkbox2 = value!;
                });
              },
            ),
            CheckboxListTile(
              title: Text("Reason 3"),
              value: checkbox3,
              onChanged: (bool? value) {
                setState(() {
                  checkbox3 = value!;
                });
              },
            ),
            SizedBox(height: 20),
            Center(
              child: ElevatedButton(
                onPressed: handleSubmit,
                style: ElevatedButton.styleFrom(
                    backgroundColor: Color(0xFF4CB1C7)
                ),
                child: Text(
                  "Next",
                  style: TextStyle(color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
