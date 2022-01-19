import mongoose from 'mongoose';


mongoose.Promise = global.Promise;
let mongoConfigs={
    reconnectTries: Number.MAX_VALUE,
    useCreateIndex: true,
    useFindAndModify:false

}
mongoose.Schema.Types.String.set('default', "");
mongoose.Schema.Types.String.set('trim', true);
mongoose.Schema.Types.Boolean.set('default', false);
const setupDb = () => {
    console.log('db initializing');
    if (process.env.MONGO_DEBUG == "true") {
        mongoose.set("debug", true);
    }
    mongoose.connection.on('connected', function () {
        console.log("Mongoose connection is open ");
    });
    mongoose.connection.on('error', function (err) {
        console.log("Mongoose error occurred: " + err);
    });
    mongoose.connection.on('disconnected', function () {
        console.log(new Date()+" Mongoose connection is disconnected");
    });
    mongoose.connection.on('reconnectFailed', function () {
        console.log(new Date()+" Mongoose reconnect failed");
    });
    return mongoose.connect(process.env.MONGO_URI,mongoConfigs).then(() => {
        console.log('db started');
        return Promise.resolve()
    }).catch(error => {
        console.error('Error starting db: ' + error);
    });
}

export default setupDb;
