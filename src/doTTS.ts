import { PythonShell } from 'python-shell';

let options = {
    args: ['VERY LONG text and all that', 'and number 2', 'and  at last number 3']
};

PythonShell.run('src/tts.py', options).then(messages => {
    // results is an array consisting of messages collected during execution
    console.log('results: %j', messages);
});