const convert = require('heic-convert');
const fs = require('fs');
const util = require('util');
const piexif = require('piexifjs')
const exifr = require('exifr');

(
    async () => {
        const filePath = 'C:/Users/KHW-IPC/Pictures/image/test3.heic';
        const extension = 'JPEG'
        try {
            const date = await exifr.parse(filePath)
                .then(output => new Date(output.DateTimeOriginal))
                .catch(err => undefined);

            const location = await exifr.gps(filePath);
            
            const inputBuffer = await util.promisify(fs.readFile)(filePath);
            const outputBuffer = await convert({
                buffer: inputBuffer,
                format: extension,
                quality: 1
            })

            const outputPath = `${filePath.split('.')[0]}.${extension}`;
            console.log('outputPath : ' + outputPath)

            fs.writeFileSync(outputPath, outputBuffer)
            
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
            fs.writeFileSync(`${filePath.split('.')[0]}_convert.${extension}`, newJpeg);

        } catch(err) {
            console.error('error occured');
            console.error(err)
        }
        
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