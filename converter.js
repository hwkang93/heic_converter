const convert = require('heic-convert');
const fs = require('fs');
const util = require('util');
const piexif = require('piexifjs')
const exifr = require('exifr');
const yaml = require('js-yaml');

//yaml 파일 읽기
const readOptions = () => {
    try {
        const file = fs.readFileSync('./options.yaml', 'utf-8');
        const doc = yaml.load(file);
        
        return {
            'path' : doc.path
        };
    } catch(e) {
        console.error(e);
    }
}

//확장자 heic인지 확인
const isHeic = file => {
    const dotLoc = file.lastIndexOf('.');
    const extension = file.substring(dotLoc, file.length).toLowerCase();
    
    return extension == '.heic';
}

const options = readOptions();
const folderPath = options.path.input;
const outputExtension = 'JPEG';

(
    async () => {
        console.log('******** FILE CONVERTER START ********')
        
        //1. heic 확장자 파일 리스트 조회
        const files = await util.promisify(fs.readdir)(folderPath)
            .then(files => files.filter(isHeic))
            .catch(error => console.error(error));
        
        console.log(`   >>  Convert files length : ${files.length}`);

        let success = 0;
        for(let i=0; i<files.length; i++) {
            const filePath = folderPath + files[i];
            const outputPath = options.path.output + files[i].split('.')[0] + '.' + outputExtension;

            console.log(`${files[i]} convert start.`)
            console.log(`   >> input file path : ${filePath}`);
            console.log(`   >> output file path : ${outputPath}`)
            
            try {
                //2. Metadata > Date 읽기
                const date = await exifr.parse(filePath)
                    .then(output => new Date(output.DateTimeOriginal))
                    .catch(err => undefined);
    
                //3. Metadata > Geometry 읽기
                const location = await exifr.gps(filePath);
                const inputBuffer = await util.promisify(fs.readFile)(filePath);
                const outputBuffer = await convert({
                    buffer: inputBuffer,
                    format: outputExtension,
                    quality: 1
                })
                
                //4. HEIC >  JPEG로 변환 ( 결과 JPEG 파일에는 메타데이터 없음 )
                fs.writeFileSync(outputPath, outputBuffer);
                
                //5. JPEG 파일 읽기
                const data = fs.readFileSync(outputPath).toString('binary');
                const exifObj = piexif.load(data);

                //6. JPEG 파일에 DATE 메타데이터 추가
                if(date) {
                    exifObj.Exif[piexif.ExifIFD.DateTimeDigitized] = dateToString(date);
                }
    
                //7. JPEG 파일에 Geometry 메타데이터 추가
                if(location) {
                    exifObj.GPS[piexif.GPSIFD.GPSLatitude] =  degToDmsRational(location.latitude);
                    exifObj.GPS[piexif.GPSIFD.GPSLatitudeRef] =  "N";
                    exifObj.GPS[piexif.GPSIFD.GPSLongitude] =  degToDmsRational(location.longitude);
                    exifObj.GPS[piexif.GPSIFD.GPSLongitudeRef] =  "W";
                }
                
                //8. 결과 JPEG 생성 (기존 JPEG 파일과 같은 이름으로 만듦)
                const exifByte = piexif.dump(exifObj);
                const newData = piexif.insert(exifByte, data);
                const newJpeg = Buffer.from(newData, "binary");
                fs.writeFileSync(outputPath, newJpeg);
                
                success = success +1;
                
                console.log(`${files[i]} convert finished. [ ${success} / ${files.length} ]`);
                
            } catch(err) {
                console.error('error occured');
                console.error(err)
            }

        }

        console.log('******** FILE CONVERTER FINISHED ********');
        console.log(`success : ${success}/${files.length}`);
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

