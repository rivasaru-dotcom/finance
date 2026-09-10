/* =========================================================
   AUSTRALIAN TAX / DUTY ENGINE
   2026–27
   ========================================================= */

/*
 * All monetary values are AUD.
 *
 * IMPORTANT:
 * These calculations are estimates for educational/general
 * planning purposes. They are NOT tax, legal or financial advice.
 *
 * Government rates can change during the financial year.
 */


/* =========================================================
   2026–27 AUSTRALIAN INDIVIDUAL INCOME TAX
   ========================================================= */

function australianIncomeTax(income) {
    income = Math.max(0, Number(income) || 0);

    let tax = 0;

    if (income <= 18_200) {
        tax = 0;
    } else if (income <= 45_000) {
        tax =
            (income - 18_200) *
            0.15;
    } else if (income <= 135_000) {
        tax =
            4_020 +
            (income - 45_000) *
            0.30;
    } else if (income <= 190_000) {
        tax =
            31_020 +
            (income - 135_000) *
            0.37;
    } else {
        tax =
            51_370 +
            (income - 190_000) *
            0.45;
    }

    return Math.max(0, tax);
}


/*
 * Approximate Medicare levy.
 *
 * This deliberately remains separate from income tax so the
 * existing UI can continue displaying the income-tax estimate.
 */

function medicareLevy(income) {
    income = Math.max(0, Number(income) || 0);

    /*
     * Simplified 2% Medicare levy estimate.
     *
     * Low-income thresholds and exemptions can apply in reality.
     */

    return income * 0.02;
}


/*
 * Total estimated tax including Medicare levy.
 */

function australianTotalTax(income) {
    return (
        australianIncomeTax(income) +
        medicareLevy(income)
    );
}


/*
 * Marginal tax rate for 2026–27.
 */

function marginalTaxRate(income) {
    income = Math.max(0, Number(income) || 0);

    if (income <= 18_200) return 0;
    if (income <= 45_000) return 15;
    if (income <= 135_000) return 30;
    if (income <= 190_000) return 37;

    return 45;
}


/*
 * Tax reduction from a deductible amount.
 *
 * This is better than simply doing:
 *
 * deductibleAmount × marginalRate
 *
 * because a deduction can cross multiple tax brackets.
 */

function taxSavingFromDeduction(
    taxableIncome,
    deduction
) {
    taxableIncome =
        Math.max(
            0,
            Number(taxableIncome) || 0
        );

    deduction =
        Math.max(
            0,
            Number(deduction) || 0
        );

    const incomeAfterDeduction =
        Math.max(
            0,
            taxableIncome - deduction
        );

    const taxBefore =
        australianTotalTax(
            taxableIncome
        );

    const taxAfter =
        australianTotalTax(
            incomeAfterDeduction
        );

    return Math.max(
        0,
        taxBefore - taxAfter
    );
}


/* =========================================================
   PROGRESSIVE CALCULATION HELPER
   ========================================================= */

function progressiveTax(
    value,
    brackets
) {
    value =
        Math.max(
            0,
            Number(value) || 0
        );

    let tax = 0;

    for (
        let i = 0;
        i < brackets.length;
        i++
    ) {
        const bracket =
            brackets[i];

        const lower =
            bracket.lower;

        const upper =
            bracket.upper;

        const rate =
            bracket.rate;

        if (value <= lower) {
            continue;
        }

        const taxableAmount =
            Math.min(
                value,
                upper
            ) - lower;

        if (taxableAmount > 0) {
            tax +=
                taxableAmount *
                rate;
        }

        if (value <= upper) {
            break;
        }
    }

    return tax;
}


/* =========================================================
   STAMP DUTY
   ========================================================= */

/*
 * NSW general transfer duty.
 *
 * 2026–27 rates.
 */

function nswStampDuty(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 18_000) {
        return value * 0.0125;
    }

    if (value <= 38_000) {
        return (
            225 +
            (value - 18_000) *
            0.015
        );
    }

    if (value <= 103_000) {
        return (
            525 +
            (value - 38_000) *
            0.0175
        );
    }

    if (value <= 387_000) {
        return (
            1_662.50 +
            (value - 103_000) *
            0.035
        );
    }

    if (value <= 1_290_000) {
        return (
            11_602.50 +
            (value - 387_000) *
            0.045
        );
    }

    if (value <= 2_000_000) {
        return (
            52_237.50 +
            (value - 1_290_000) *
            0.055
        );
    }

    /*
     * Premium residential property duty.
     */

    return (
        91_287.50 +
        (value - 2_000_000) *
        0.075
    );
}


/*
 * Victoria general land transfer duty.
 *
 * This function uses the standard non-concessional
 * residential/general transfer-duty structure.
 */

function vicStampDuty(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 25_000) {
        return value * 0.014;
    }

    if (value <= 130_000) {
        return (
            350 +
            (value - 25_000) *
            0.024
        );
    }

    if (value <= 960_000) {
        return (
            2_870 +
            (value - 130_000) *
            0.06
        );
    }

    if (value < 2_000_000) {
        return value * 0.055;
    }

    /*
     * Premium duty.
     */

    return (
        110_000 +
        (value - 2_000_000) *
        0.065
    );
}


/*
 * Queensland transfer duty.
 *
 * Standard rates.
 */

function qldStampDuty(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 5_000) {
        return 0;
    }

    if (value <= 75_000) {
        return (
            (value - 5_000) *
            0.015
        );
    }

    if (value <= 540_000) {
        return (
            1_050 +
            (value - 75_000) *
            0.035
        );
    }

    if (value <= 1_000_000) {
        return (
            17_325 +
            (value - 540_000) *
            0.045
        );
    }

    return (
        38_025 +
        (value - 1_000_000) *
        0.0575
    );
}


/*
 * South Australia transfer duty.
 */

function saStampDuty(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 12_000) {
        return value * 0.01;
    }

    if (value <= 30_000) {
        return (
            120 +
            (value - 12_000) *
            0.02
        );
    }

    if (value <= 50_000) {
        return (
            480 +
            (value - 30_000) *
            0.03
        );
    }

    if (value <= 100_000) {
        return (
            1_080 +
            (value - 50_000) *
            0.035
        );
    }

    if (value <= 200_000) {
        return (
            2_830 +
            (value - 100_000) *
            0.04
        );
    }

    if (value <= 250_000) {
        return (
            6_830 +
            (value - 200_000) *
            0.0425
        );
    }

    if (value <= 300_000) {
        return (
            8_955 +
            (value - 250_000) *
            0.0475
        );
    }

    if (value <= 500_000) {
        return (
            11_330 +
            (value - 300_000) *
            0.05
        );
    }

    return (
        21_330 +
        (value - 500_000) *
        0.055
    );
}


/*
 * Western Australia transfer duty.
 */

function waStampDuty(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 120_000) {
        return value * 0.019;
    }

    if (value <= 150_000) {
        return (
            2_280 +
            (value - 120_000) *
            0.0285
        );
    }

    if (value <= 360_000) {
        return (
            3_135 +
            (value - 150_000) *
            0.0325
        );
    }

    if (value <= 725_000) {
        return (
            9_960 +
            (value - 360_000) *
            0.035
        );
    }

    return (
        22_735 +
        (value - 725_000) *
        0.0425
    );
}


/*
 * Tasmania transfer duty.
 */

function tasStampDuty(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 3_000) {
        return 50;
    }

    if (value <= 25_000) {
        return (
            50 +
            (value - 3_000) *
            0.0175
        );
    }

    if (value <= 75_000) {
        return (
            435 +
            (value - 25_000) *
            0.0225
        );
    }

    if (value <= 200_000) {
        return (
            1_560 +
            (value - 75_000) *
            0.035
        );
    }

    if (value <= 375_000) {
        return (
            5_935 +
            (value - 200_000) *
            0.04
        );
    }

    if (value <= 725_000) {
        return (
            12_935 +
            (value - 375_000) *
            0.0425
        );
    }

    return (
        27_810 +
        (value - 725_000) *
        0.045
    );
}


/*
 * ACT conveyance duty.
 */

function actStampDuty(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 300_000) {
        return value * 0.022;
    }

    if (value <= 500_000) {
        return (
            6_600 +
            (value - 300_000) *
            0.035
        );
    }

    if (value <= 750_000) {
        return (
            13_600 +
            (value - 500_000) *
            0.04
        );
    }

    if (value <= 1_000_000) {
        return (
            23_600 +
            (value - 750_000) *
            0.0425
        );
    }

    if (value <= 1_455_000) {
        return (
            34_225 +
            (value - 1_000_000) *
            0.045
        );
    }

    if (value <= 3_000_000) {
        return (
            54_700 +
            (value - 1_455_000) *
            0.049
        );
    }

    return (
        130_405 +
        (value - 3_000_000) *
        0.0475
    );
}


/*
 * Northern Territory transfer duty.
 */

function ntStampDuty(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 525_000) {
        return (
            0.065 *
            value -
            18_750
        );
    }

    if (value <= 2_525_000) {
        return (
            0.0495 *
            value
        );
    }

    /*
     * Above the upper threshold the calculation
     * uses a fixed component plus 5.95%.
     */

    return (
        111_237.50 +
        (value - 2_525_000) *
        0.0595
    );
}


/*
 * Main stamp-duty dispatcher.
 */

function calculateStampDutyByState(
    state,
    propertyValue
) {
    const value =
        Math.max(
            0,
            Number(propertyValue) || 0
        );

    switch (
        String(state)
            .trim()
            .toUpperCase()
    ) {

        case "NSW":
        case "NEW SOUTH WALES":
            return nswStampDuty(value);

        case "VIC":
        case "VICTORIA":
            return vicStampDuty(value);

        case "QLD":
        case "QUEENSLAND":
            return qldStampDuty(value);

        case "SA":
        case "SOUTH AUSTRALIA":
            return saStampDuty(value);

        case "WA":
        case "WESTERN AUSTRALIA":
            return waStampDuty(value);

        case "TAS":
        case "TASMANIA":
            return tasStampDuty(value);

        case "ACT":
            return actStampDuty(value);

        case "NT":
        case "NORTHERN TERRITORY":
            return ntStampDuty(value);

        default:
            return 0;
    }
}


/* =========================================================
   LAND TAX — 2026–27
   ========================================================= */

/*
 * NSW
 *
 * General threshold:
 * $1.075m
 *
 * Premium threshold:
 * $6.571m
 */

function nswLandTax(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 1_075_000) {
        return 0;
    }

    if (value <= 6_571_000) {
        return (
            100 +
            (value - 1_075_000) *
            0.016
        );
    }

    return (
        88_036 +
        (value - 6_571_000) *
        0.02
    );
}


/*
 * Victoria land tax.
 */

function vicLandTax(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value < 50_000) {
        return 0;
    }

    if (value < 100_000) {
        return 500;
    }

    if (value < 300_000) {
        return 975;
    }

    if (value < 600_000) {
        return (
            1_350 +
            (value - 300_000) *
            0.003
        );
    }

    if (value < 1_000_000) {
        return (
            2_250 +
            (value - 600_000) *
            0.006
        );
    }

    if (value < 1_800_000) {
        return (
            4_650 +
            (value - 1_000_000) *
            0.009
        );
    }

    if (value < 2_000_000) {
        return (
            11_850 +
            (value - 1_800_000) *
            0.013
        );
    }

    if (value < 3_000_000) {
        return (
            14_450 +
            (value - 2_000_000) *
            0.018
        );
    }

    if (value < 5_000_000) {
        return (
            32_450 +
            (value - 3_000_000) *
            0.018
        );
    }

    return (
        68_450 +
        (value - 5_000_000) *
        0.0225
    );
}


/*
 * Queensland individual land tax.
 */

function qldLandTax(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value < 600_000) {
        return 0;
    }

    if (value < 1_000_000) {
        return (
            500 +
            (value - 600_000) *
            0.01
        );
    }

    if (value < 3_000_000) {
        return (
            4_500 +
            (value - 1_000_000) *
            0.0165
        );
    }

    if (value < 5_000_000) {
        return (
            37_500 +
            (value - 3_000_000) *
            0.017
        );
    }

    if (value < 10_000_000) {
        return (
            71_500 +
            (value - 5_000_000) *
            0.0175
        );
    }

    return (
        159_000 +
        (value - 10_000_000) *
        0.02
    );
}


/*
 * South Australia general land tax.
 *
 * 2026–27 threshold structure.
 */

function saLandTax(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 25_000) {
        return 0;
    }

    if (value <= 936_000) {
        return (
            125 +
            Math.ceil(
                (value - 25_000) / 100
            ) *
            0.50
        );
    }

    if (value <= 1_504_000) {
        return (
            4_680 +
            Math.ceil(
                (value - 936_000) / 100
            )
        );
    }

    if (value <= 2_188_000) {
        return (
            10_360 +
            Math.ceil(
                (value - 1_504_000) / 100
            ) *
            1.50
        );
    }

    if (value <= 3_504_000) {
        return (
            20_620 +
            Math.ceil(
                (value - 2_188_000) / 100
            ) *
            2.40
        );
    }

    return (
        52_204 +
        Math.ceil(
            (value - 3_504_000) / 100
        ) *
        2.40
    );
}


/*
 * Western Australia land tax.
 *
 * General individual calculation.
 */

function waLandTax(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 300_000) {
        return 0;
    }

    if (value <= 1_000_000) {
        return (
            (value - 300_000) *
            0.0025
        );
    }

    if (value <= 1_800_000) {
        return (
            1_750 +
            (value - 1_000_000) *
            0.009
        );
    }

    if (value <= 5_000_000) {
        return (
            8_950 +
            (value - 1_800_000) *
            0.015
        );
    }

    if (value <= 11_000_000) {
        return (
            56_950 +
            (value - 5_000_000) *
            0.018
        );
    }

    return (
        164_950 +
        (value - 11_000_000) *
        0.025
    );
}


/*
 * Tasmania land tax.
 */

function tasLandTax(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 124_999.99) {
        return 0;
    }

    if (value < 500_000) {
        return (
            50 +
            (value - 125_000) *
            0.0045
        );
    }

    return (
        1_737.50 +
        (value - 500_000) *
        0.015
    );
}


/*
 * ACT land tax.
 */

function actLandTax(value) {

    value =
        Math.max(
            0,
            Number(value) || 0
        );

    if (value <= 150_000) {
        return value * 0.0054;
    }

    if (value <= 275_000) {
        return (
            810 +
            (value - 150_000) *
            0.0064
        );
    }

    if (value <= 1_000_000) {
        return (
            1_610 +
            (value - 275_000) *
            0.0124
        );
    }

    if (value <= 2_000_000) {
        return (
            10_610 +
            (value - 1_000_000) *
            0.0125
        );
    }

    return (
        23_110 +
        (value - 2_000_000) *
        0.0126
    );
}


/*
 * Northern Territory land tax.
 *
 * NT does not impose a general land tax on freehold land.
 */

function ntLandTax() {
    return 0;
}


/*
 * Main land-tax dispatcher.
 */

function calculateLandTaxByState(
    state,
    landValue
) {
    const value =
        Math.max(
            0,
            Number(landValue) || 0
        );

    switch (
        String(state)
            .trim()
            .toUpperCase()
    ) {

        case "NSW":
        case "NEW SOUTH WALES":
            return nswLandTax(value);

        case "VIC":
        case "VICTORIA":
            return vicLandTax(value);

        case "QLD":
        case "QUEENSLAND":
            return qldLandTax(value);

        case "SA":
        case "SOUTH AUSTRALIA":
            return saLandTax(value);

        case "WA":
        case "WESTERN AUSTRALIA":
            return waLandTax(value);

        case "TAS":
        case "TASMANIA":
            return tasLandTax(value);

        case "ACT":
            return actLandTax(value);

        case "NT":
        case "NORTHERN TERRITORY":
            return ntLandTax(value);

        default:
            return 0;
    }
}


/* =========================================================
   TAX DEDUCTION CALCULATOR
   ========================================================= */

function calculateTax() {

    const loan =
        getNumber("taxLoan");

    const rate =
        getNumber("taxRate");

    const term =
        getNumber("taxTerm");

    const taxableIncome =
        getNumber("taxIncome");

    const rentalIncome =
        getNumber("taxRent");

    const otherExpenses =
        getNumber("taxExpenses");

    const depreciation =
        getNumber("taxDep");


    if (
        !validateLoan(
            loan,
            rate,
            term
        )
    ) {
        return;
    }


    /*
     * Approximate annual interest.

     * This is deliberately labelled as an estimate.
     * Actual deductible interest depends on loan balance
     * throughout the year and loan purpose.
     */

    const annualInterest =
        loan *
        rate /
        100;


    const deductibleCosts =
        Math.max(
            0,
            annualInterest
        ) +
        Math.max(
            0,
            otherExpenses
        ) +
        Math.max(
            0,
            depreciation
        );


    /*
     * Rental profit/loss before tax.
     */

    const rentalPosition =
        rentalIncome -
        deductibleCosts;


    /*
     * Tax saving from the actual reduction
     * in taxable income.
     */

    const taxSaving =
        taxSavingFromDeduction(
            taxableIncome,
            deductibleCosts
        );


    /*
     * After-tax rental cash flow.

     * Note that depreciation is a non-cash deduction,
     * so a real cash-flow model should treat it separately.
     */

    const cashExpenses =
        annualInterest +
        Math.max(
            0,
            otherExpenses
        );

    const cashRentalPosition =
        rentalIncome -
        cashExpenses;

    const afterTaxCashflow =
        cashRentalPosition +
        taxSaving;


    setText(
        "taxDeduction",
        money(
            deductibleCosts
        )
    );

    setText(
        "taxInterest",
        money(
            annualInterest
        )
    );

    setText(
        "taxNet",
        money(
            rentalPosition
        )
    );

    setText(
        "taxSaving",
        money(
            taxSaving
        )
    );

    setText(
        "taxCashflow",
        money(
            afterTaxCashflow
        )
    );


    return {
        annualInterest,
        deductibleCosts,
        rentalPosition,
        taxSaving,
        cashRentalPosition,
        afterTaxCashflow
    };
}


/* =========================================================
   STAMP DUTY UI CALCULATOR
   ========================================================= */

function calculateStamp() {

    const propertyValue =
        getNumber(
            "stampPropertyValue"
        );

    const state =
        getValue(
            "stampState"
        );


    if (
        propertyValue <= 0
    ) {
        error(
            "Please enter a property value greater than $0."
        );

        return;
    }


    const duty =
        calculateStampDutyByState(
            state,
            propertyValue
        );


    const effectiveRate =
        propertyValue > 0
            ? (
                duty /
                propertyValue
            ) *
            100
            : 0;


    setText(
        "stampDuty",
        money(
            duty
        )
    );

    setText(
        "stampRate",
        percent(
            effectiveRate,
            2
        )
    );


    return {
        propertyValue,
        state,
        duty,
        effectiveRate
    };
}


/* =========================================================
   LAND TAX UI CALCULATOR
   ========================================================= */

function calculateLandTax() {

    const landValue =
        getNumber(
            "landValue"
        );

    const state =
        getValue(
            "landState"
        );


    if (
        landValue < 0
    ) {
        error(
            "Please enter a valid land value."
        );

        return;
    }


    const tax =
        calculateLandTaxByState(
            state,
            landValue
        );


    const effectiveRate =
        landValue > 0
            ? (
                tax /
                landValue
            ) *
            100
            : 0;


    setText(
        "landTax",
        money(
            tax
        )
    );

    setText(
        "landRate",
        percent(
            effectiveRate,
            2
        )
    );


    return {
        landValue,
        state,
        tax,
        effectiveRate
    };
}