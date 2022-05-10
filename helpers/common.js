const randomString = (length) => {
    let result = "";
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};


let arrayToAssociativeObj = (array, basedOnKey) => {
    let obj = {}
    array.forEach(o => {
        obj[o[basedOnKey]] = o
    })
    return obj
}

const isNumber = (value) => {
    return typeof value === 'number' && isFinite(value);
}
const parseIp = (req) => {
    return (req.headers['x-forwarded-for'] || '').split(',').pop().trim() ||
        req.socket.remoteAddress
}
const getS3Url=()=>{
    return "https://" + process.env.S3_BUCKET_NAME.substr(0, process.env.S3_BUCKET_NAME.length - 1) + ".s3.ap-south-1.amazonaws.com/"
}
const capitalizeFirstLetter = (string) => {
    if (string)
        return string.charAt(0).toUpperCase() + string.slice(1);
    return string
}

let compareObjGetDiff = function () {
    return {
      VALUE_CREATED: 'created',
      VALUE_UPDATED: 'updated',
      VALUE_DELETED: 'deleted',
      VALUE_UNCHANGED: 'unchanged',
      map: function(obj1, obj2) {
        if (this.isFunction(obj1) || this.isFunction(obj2)) {
          throw 'Invalid argument. Function given, object expected.';
        }
        if (this.isValue(obj1) || this.isValue(obj2)) {
          
          let resData = this.compareValues(obj1, obj2);
          if(resData ==='updated') {
            return {
              type: this.compareValues(obj1, obj2),
              data: obj1 === undefined ? obj2 : obj1
            };
          } else {
            return false ;
          }
        }
        var diff = {};
        for (var key in obj1) {
          if (this.isFunction(obj1[key])) {
            continue;
          }
  
          var value2 = undefined;
          if (obj2[key] !== undefined) {
            value2 = obj2[key];
          }
  
          diff[key] = this.map(obj1[key], value2);
        }
        for (var key in obj2) {
          if (this.isFunction(obj2[key]) || diff[key] !== undefined) {
            continue;
          }
  
          diff[key] = this.map(undefined, obj2[key]);
        }
  
        return diff;
  
      },
      compareValues: function (value1, value2) {
        /* if (value1 === value2) {
          return this.VALUE_UNCHANGED;
        }
        if (this.isDate(value1) && this.isDate(value2) && value1.getTime() === value2.getTime()) {
          return this.VALUE_UNCHANGED;
        }
        if (value1 === undefined) {
          return this.VALUE_CREATED;
        }
        if (value2 === undefined) {
          return this.VALUE_DELETED;
        } */
        if (typeof value1 === 'string' && typeof value1 !== 'undefined' && typeof value2 !== 'undefined') {
            if (value1.toString() !== value2.toString()) {
                return this.VALUE_UPDATED;
            } else {
                return this.VALUE_UNCHANGED;
            }
        }

        if (typeof value1 === 'number' && typeof value1 !== 'undefined' && typeof value2 !== 'undefined') {
            if (Number(value1)!== Number(value2)) {
                return this.VALUE_UPDATED;
            } else {
                return this.VALUE_UNCHANGED;
            }
        }

        if (typeof value1 === 'object' && typeof value1 !== 'undefined' && typeof value2 !== 'undefined') {
            if (JSON.stringify(value1) !== JSON.stringify(value2)) {
                return this.VALUE_UPDATED;
            } else {
                return this.VALUE_UNCHANGED;
            }
        }
        return this.VALUE_UNCHANGED;
      },
      isFunction: function (x) {
        return Object.prototype.toString.call(x) === '[object Function]';
      },
      isArray: function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      },
      isDate: function (x) {
        return Object.prototype.toString.call(x) === '[object Date]';
      },
      isObject: function (x) {
        return Object.prototype.toString.call(x) === '[object Object]';
      },
      isValue: function (x) {
        return !this.isObject(x) && !this.isArray(x);
      }
    }
}();

module.exports = {
    randomString,
    arrayToAssociativeObj,
    isNumber, parseIp,
    capitalizeFirstLetter,
    compareObjGetDiff
};
