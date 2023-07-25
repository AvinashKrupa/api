import {jsonResponse} from "../../helpers/responseHelper";
import {createPdfOfHtmlDoc} from "../../helpers/pdfGenHelper";

const index = (req, res) => {
    return jsonResponse(
        res,
        {},
        "success",
        200
    );
}

const renderPrescriptionPdf = async (req, res) => {
    await createPdfOfHtmlDoc({});
    res.render('prescriptionPdf.ejs');
}

module.exports = {
    index,
    renderPrescriptionPdf
}
