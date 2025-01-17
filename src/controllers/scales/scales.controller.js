const processResponse = require("../../utils/processResponse");
const chalk = require("chalk");


const controller = {
    fetchMany: (req,res)=>{
        try {
              // return success response
              processResponse({
                req, res, success: true, status: 200,
                message: {
                    en: "Test response",
                },
            });
        } catch (error) {
            console.log(chalk.red("Error fetching scales"), error);
            processResponse({
                req, res, success: false, status: 500,
                message: {
                    en: "Error fetching scales",
                },
            });
        }
    }
}

module.exports =  controller;