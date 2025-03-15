from flask import Flask, render_template, request

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/response', methods=['POST'])
def response():
    # Handle the form submission and analysis here
    # For example, you can get the uploaded file using request.files['imageInput']
    # and perform the analysis, then pass the results to the template
    return render_template('response.html', analysis_result={})

if __name__ == '__main__':
    app.run(debug=True)
