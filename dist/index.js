const args = process.argv.slice(2);
const scriptName = args[0] || 'stdio';
async function run() {
    try {
        switch (scriptName) {
            case 'stdio':
                await import('./stdio.js');
                break;
            default:
                console.error(`Unknown script: ${scriptName}`);
                console.log('Available scripts:');
                console.log('- stdio');
                console.log('- streamableHttp');
                process.exit(1);
        }
    }
    catch (error) {
        console.error('Error running script,', error);
        process.exit(1);
    }
}
run();
export {};
