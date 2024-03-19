const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const bodyParser = require("body-parser");
require("dotenv").config();
const path = require("path");

const PORT = 3000;
const app = express();

app.use(express.json({extended: false}));
app.use(express.static('/views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.set('view engine', 'ejs');
app.set('views', './views');


process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = "1";

AWS.config.update({
    region: process.env.REGION,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY
})

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const bucketName = process.env.S3_BUCKET_NAME;
const tableName = process.env.DYNAMODB_TABLE_NAME;

const storage = multer.memoryStorage({
    destination(req, file, callback) {
        callback(null, "");
    }
});

const upload = multer({
    storage,
    limits: {fileSize: 2000000},
    fileFilter(req, file, cb) {
        checkFileType(file, cb);
    }
});

function checkFileType(file, cb) {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
        return cb(null, true);
    } return cb("Error: Pls upload images /jpeg|jpg|png|gif/ only !");
}


app.get('/' , async (req , res)=>{

   try {
    const params = {TableName: tableName};
    const data = await dynamodb.scan(params).promise();
    console.log("data = ", data.Items);
    return res.render("index.ejs", {data: data.Items,  numberWithCommas : function (x) {
        if(!x) {
            return;
        }
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }});
   } catch (error) {
    console.error("Error retrieving data from DynamoDB: ", error);
    return res.status(500).send("Internal Server Error");
   }
});

app.post("/save", upload.single("hinhXe"), (req, res) => {
    try {
        const maXe = req.body.maXe;
        const tenXe = req.body.tenXe;
        const dongXe = req.body.dongXe;
        const loaiXe = req.body.loaiXe;
        const gia = req.body.gia;
        const hinhXe = req.file.originalname.split(".");
        const fileType = hinhXe[hinhXe.length - 1];
        const filePath = `${maXe}_${Date.now().toString()}.${fileType}`;

        const paramsS3 = {
            Bucket: bucketName,
            Key: filePath,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        };

        s3.upload(paramsS3, async (err, data) => {
            if (err) {
                console.error("error: ", err);
                return res.send("Internal Server Error");
            } else {
                const hinhXeURL = data.Location;
                const paramsDynamoDb = {
                    TableName: tableName,
                    Item: {
                        maXe: maXe,
                        tenXe: tenXe,
                        dongXe: dongXe,
                        loaiXe: loaiXe,
                        gia: gia,
                        hinhXe: hinhXeURL
                    }
                };

                await dynamodb.put(paramsDynamoDb).promise();
                return res.redirect("/");
            }
        });
    } catch (error) {
    console.error("Error saving data from DynamoDB: ", error);
    return res.status(500).send("Internal Server Error");
    }
});

app.post('/delete/:maXe', (req , res)=>{
    const maXe = req.params.maXe;
    if(!maXe) {
        return res.redirect("/");
    }
    try {
        function onDeleteItem(maXe) {
            const params = {
                TableName: tableName,
                Key: {
                    maXe: maXe
                }
            };

            dynamodb.delete(params, (err, data) => {
                if(err) {
                    console.error("error = ", err);
                    return res.send("Internal Server Error");
                } else return res.redirect("/");
            });
        }
        onDeleteItem(maXe);
    } catch (error) {
        console.error("Error deleting data from DynamoDB: ", error);
        return res.status(500).send("Internal Server Error");
    }

})

app.get('/update/:maXe' , async (req , res)=>{
    const maXe = req.params.maXe;
    if(!maXe) {
        return res.redirect("/");
    } 
    const params = {
        TableName: tableName,
        Key: {
            maXe: maXe
        }
    };
    const data = await dynamodb.get(params).promise();
    console.log("data_update = ", data.Item);
    return res.render("update.ejs", {data: data.Item});
})

app.post('/update', upload.single("hinhXe"), async (req , res)=>{

    const maXe = req.body.maXe;
    const tenXe = req.body.tenXe;
    const dongXe = req.body.dongXe;
    const loaiXe = req.body.loaiXe;
    const gia = req.body.gia;
    
    if(!req.file) {
        const paramsDynamoDb = {
            TableName: tableName,
            Key: {maXe: maXe},
            UpdateExpression: "set tenXe = :tx, dongXe = :dx, loaiXe = :lx, gia = :g",
            ExpressionAttributeValues: {
                ":tx": tenXe,
                ":dx": dongXe,
                ":lx": loaiXe,
                ":g": gia
            }
        };

        await dynamodb.update(paramsDynamoDb).promise();
        return res.redirect("/");
    } else {
        const hinhXe = req.file.originalname.split(".");
        const fileType = hinhXe[hinhXe.length - 1];
        const filePath = `${maXe}_${Date.now().toString()}.${fileType}`;    
        
        const paramsS3 = {
            Bucket: bucketName,
            Key: filePath,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        };

        s3.upload(paramsS3, async (err, data) => {
            if (err) {
                console.error("error: ", err);
                return res.send("Internal Server Error");
            } else {
                const hinhXeURL = data.Location;
                const paramsDynamoDb = {
                    TableName: tableName,
                    Key: {maXe: maXe},
                    UpdateExpression: "set tenXe = :tx, dongXe = :dx, loaiXe = :lx, hinhXe = :hx",
                    ExpressionAttributeValues: {
                        ":tx": tenXe,
                        ":dx": dongXe,
                        ":lx": loaiXe,
                        ":hx": hinhXeURL
                    }
                };
    
                await dynamodb.update(paramsDynamoDb).promise();
                return res.redirect("/");
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})