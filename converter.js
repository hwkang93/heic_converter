const convert = require('heic-convert');
const fs = require('fs');
const util = require('util');
const piexif = require('piexifjs')
const exifr = require('exifr');
const yaml = require('js-yaml');

const readOptions = () => {
    try {
        const file = fs.readFileSync('./options.yaml', 'utf-8');
        const doc = yaml.load(file);
        
        return {
            'extension' : doc.extension,
            'path' : doc.path
        };
    } catch(e) {
        console.error(e);
    }
}

const hasExtensions = file => {
    let result = false;
    allowedExtensions.forEach(extension => {
        if(file.includes(extension)) {
            result = true;
        }
    })

    return result;
}

const options = readOptions();
const allowedExtensions = options.extension.inputs;
const convertedExtension = options.extension.output;
const folderPath = options.path.input;

(
    async () => {

        console.log('******** FILE CONVERTER START ********')
        console.log('convert option : ')
        console.log('  input extensions : ')
        console.log(allowedExtensions)
        console.log(`  output extension : ${convertedExtension}`)

        const files = await util.promisify(fs.readdir)(folderPath)
            .then(files => files.filter(hasExtensions))
            .catch(error => console.error(error));
        
        console.log(`conver files length : ${files.length}`);

        let success = 0;
        for(let i=0; i<files.length; i++) {
            const filePath = folderPath + files[i];
            console.log(`${filePath} convert start.`)
            let outputPath = filePath;
            
            console.log('outputPath : ' + outputPath)

            try {
                const date = await exifr.parse(filePath)
                    .then(output => new Date(output.DateTimeOriginal))
                    .catch(err => undefined);
    
                const location = await exifr.gps(filePath);

                if(filePath.includes('.heic')) {
                    const inputBuffer = await util.promisify(fs.readFile)(filePath);
                    const outputBuffer = await convert({
                        buffer: inputBuffer,
                        format: 'JPEG',
                        quality: 1
                    })
        
                    fs.writeFileSync(outputPath, outputBuffer);
                    outputPath = `${filePath.split('.')[0]}${convertedExtension}`;
                }
                
                const data = fs.readFileSync(outputPath).toString('binary');
                const exifObj = piexif.load(data);
                if(date) {
                    exifObj.Exif[piexif.ExifIFD.DateTimeDigitized] = dateToString(date);
                }
    
                if(location) {
                    exifObj.GPS[piexif.GPSIFD.GPSLatitude] =  degToDmsRational(location.latitude);
                    exifObj.GPS[piexif.GPSIFD.GPSLatitudeRef] =  "N";
                    exifObj.GPS[piexif.GPSIFD.GPSLongitude] =  degToDmsRational(location.longitude);
                    exifObj.GPS[piexif.GPSIFD.GPSLongitudeRef] =  "W";
                }
                
                const exifByte = piexif.dump(exifObj);
                const newData = piexif.insert(exifByte, data);
                const newJpeg = Buffer.from(newData, "binary");
                fs.writeFileSync(`${filePath.split('.')[0]}_convert${extension}`, newJpeg);

                success = success +1;
            } catch(err) {
                console.error('error occured');
                console.error(err)
            }
        }


        console.log('******** FILE CONVERTER FINISHED ********')
        console.log(`success : ${success}/${files.length}`)
    }
)();

function degToDmsRational(degFloat) {
    var minFloat = degFloat % 1 * 60
    var secFloat = minFloat % 1 * 60
    var deg = Math.floor(degFloat)
    var min = Math.floor(minFloat)
    var sec = Math.round(secFloat * 100)

    deg = Math.abs(deg) * 1
    min = Math.abs(min) * 1
    sec = Math.abs(sec) * 1
  
    return [[deg, 1], [min, 1], [sec, 100]]
}

function dateToString(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();

    return `${year}:${month}:${day} ${hour}:${minute}:${second}`;
}
