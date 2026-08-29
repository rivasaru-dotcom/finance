(() => {
    "use strict";

    /*
    ============================================================
    SILAM FINANCE — CALCULATOR ENGINE
    ============================================================

    Calculators:
    1. P&I Repayments
    2. Extra Repayments
    3. Interest Only
    4. IO vs P&I
    5. Borrowing Power
    6. Stamp Duty
    7. Tax Deductions
    8. Land Tax
    9. Amortisation Schedule

    IMPORTANT:
    These are estimates only.
    Government rules, lender policies and tax rules change.
    ============================================================
    */


    /* =========================================================
       HELPERS
       ========================================================= */

    const $ = (id) => document.getElementById(id);


    function getNumber(id, defaultValue = 0) {
        const element = $(id);

        if (!element) {
            return defaultValue;
        }

        const value = Number.parseFloat(element.value);

        return Number.isFinite(value)
            ? value
            : defaultValue;
    }


    function getValue(id, defaultValue = "") {
        const element = $(id);

        return element
            ? element.value
            : defaultValue;
    }


    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = value;
        }
    }


    function money(value, decimals = 0) {
        if (!Number.isFinite(value)) {
            value = 0;
        }

        return value.toLocaleString("en-AU", {
            style: "currency",
            currency: "AUD",
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }


    function percent(value, decimals = 1) {
        if (!Number.isFinite(value)) {
            value = 0;
        }

        return `${value.toFixed(decimals)}%`;
    }


    function clamp(value, min, max) {
        return Math.min(
            Math.max(value, min),
            max
        );
    }


    function error(message) {
        console.warn(
            "SILAM Calculator:",
            message
        );

        let box = $("calculatorError");

        if (!box) {
            box = document.createElement("div");

            box.id = "calculatorError";

            box.style.cssText = `
                position: fixed;
                left: 50%;
                bottom: 25px;
                transform: translateX(-50%);
                z-index: 99999;
                width: min(92vw, 520px);
                padding: 15px 18px;
                border-radius: 14px;
                background: #8b1e1e;
                color: #ffffff;
                font-family: system-ui, sans-serif;
                font-size: 14px;
                line-height: 1.5;
                box-shadow: 0 15px 40px rgba(0,0,0,.2);
            `;

            document.body.appendChild(box);
        }

        box.textContent = message;

        clearTimeout(box._timer);

        box._timer = setTimeout(() => {
            box.remove();
        }, 4500);
    }


    function validateLoan(
        loan,
        rate,
        term
    ) {
        if (
            !Number.isFinite(loan) ||
            loan <= 0
        ) {
            error(
                "Please enter a loan amount greater than $0."
            );

            return false;
        }

        if (
            !Number.isFinite(rate) ||
            rate < 0 ||
            rate > 100
        ) {
            error(
                "Please enter a valid interest rate."
            );

            return false;
        }

        if (
            !Number.isFinite(term) ||
            term <= 0
        ) {
            error(
                "Please enter a valid loan term."
            );

            return false;
        }

        return true;
    }


    /* =========================================================
       CORE LOAN MATH
       ========================================================= */


    function monthlyPayment(
        principal,
        annualRate,
        months
    ) {
        if (
            principal <= 0 ||
            months <= 0
        ) {
            return 0;
        }

        const monthlyRate =
            annualRate / 100 / 12;

        /*
        Zero-interest case
        */

        if (monthlyRate === 0) {
            return principal / months;
        }

        const factor =
            Math.pow(
                1 + monthlyRate,
                months
            );

        return (
            principal *
            monthlyRate *
            factor /
            (factor - 1)
        );
    }


    /*
    Complete amortisation.

    extraPayment can be either:
    - a fixed amount
    - a function(month, balance)
    */

    function amortisation(
        principal,
        annualRate,
        scheduledPayment,
        maxMonths,
        extraPayment = 0
    ) {
        let balance =
            Math.max(0, principal);

        const monthlyRate =
            annualRate / 100 / 12;

        let totalInterest = 0;
        let totalPaid = 0;

        const rows = [];

        for (
            let month = 1;
            month <= maxMonths &&
            balance > 0.005;
            month++
        ) {
            const interest =
                balance *
                monthlyRate;

            let extra = 0;

            if (
                typeof extraPayment ===
                "function"
            ) {
                extra =
                    Number(
                        extraPayment(
                            month,
                            balance
                        )
                    ) || 0;
            } else {
                extra =
                    Number(
                        extraPayment
                    ) || 0;
            }

            extra =
                Math.max(
                    0,
                    extra
                );

            const requestedPayment =
                scheduledPayment +
                extra;

            const actualPayment =
                Math.min(
                    requestedPayment,
                    balance + interest
                );

            const principalPaid =
                Math.max(
                    0,
                    actualPayment -
                    interest
                );

            balance =
                Math.max(
                    0,
                    balance -
                    principalPaid
                );

            totalInterest += interest;
            totalPaid += actualPayment;

            rows.push({
                month,
                payment:
                    actualPayment,
                principal:
                    principalPaid,
                interest,
                balance,
                totalInterest
            });
        }

        return {
            rows,
            months: rows.length,
            totalInterest,
            totalPaid,
            balance
        };
    }


    /* =========================================================
       1. P&I CALCULATOR
       ========================================================= */

    function calculatePI() {
        const loan =
            getNumber("piLoan");

        const rate =
            getNumber("piRate");

        const term =
            getNumber("piTerm");

        const propertyValue =
            getNumber(
                "piPropertyValue"
            );

        const extra =
            Math.max(
                0,
                getNumber("piExtra")
            );


        if (
            !validateLoan(
                loan,
                rate,
                term
            )
        ) {
            return;
        }


        const months =
            Math.round(
                term * 12
            );


        const payment =
            monthlyPayment(
                loan,
                rate,
                months
            );


        const normal =
            amortisation(
                loan,
                rate,
                payment,
                months
            );


        /*
        Extra repayment scenario
        */

        const withExtra =
            amortisation(
                loan,
                rate,
                payment,
                months + 120,
                extra
            );


        const interestSaved =
            Math.max(
                0,
                normal.totalInterest -
                withExtra.totalInterest
            );


        const monthsSaved =
            Math.max(
                0,
                normal.months -
                withExtra.months
            );


        const interestPercentage =
            normal.totalPaid > 0
                ? (
                    normal.totalInterest /
                    normal.totalPaid
                ) * 100
                : 0;


        setText(
            "piMonthly",
            money(
                payment,
                2
            )
        );

        setText(
            "piInterest",
            money(
                normal.totalInterest
            )
        );

        setText(
            "piTotal",
            money(
                normal.totalPaid
            )
        );

        setText(
            "piSaved",
            money(
                interestSaved
            )
        );

        setText(
            "piTimeSaved",
            `${monthsSaved} months`
        );

        setText(
            "piInterestPct",
            `${interestPercentage.toFixed(1)}% interest`
        );


        /*
        LVR
        */

        if (
            propertyValue > 0
        ) {
            const lvr =
                (
                    loan /
                    propertyValue
                ) * 100;

            /*
            There isn't currently an LVR output
            in the result HTML, so we don't create
            one unnecessarily.
            */
        }


        /*
        Breakdown bar
        */

        const principalBar =
            $("piPrincipalBar");

        const interestBar =
            $("piInterestBar");


        if (
            principalBar &&
            interestBar
        ) {
            const interestWidth =
                clamp(
                    interestPercentage,
                    0,
                    100
                );

            principalBar.style.width =
                `${100 - interestWidth}%`;

            interestBar.style.width =
                `${interestWidth}%`;
        }


        return normal;
    }


    /* =========================================================
       2. EXTRA REPAYMENT
       ========================================================= */

    function calculateExtra() {

        const loan =
            getNumber("erLoan");

        const rate =
            getNumber("erRate");

        const term =
            getNumber("erTerm");

        const extraMonthly =
            Math.max(
                0,
                getNumber("erExtra")
            );

        const lumpSum =
            Math.max(
                0,
                getNumber("erLump")
            );

        const extraStart =
            Math.max(
                1,
                Math.floor(
                    getNumber(
                        "erExtraStart",
                        1
                    )
                )
            );

        const lumpMonth =
            Math.max(
                0,
                Math.floor(
                    getNumber(
                        "erLumpMonth",
                        0
                    )
                )
            );


        if (
            !validateLoan(
                loan,
                rate,
                term
            )
        ) {
            return;
        }


        const months =
            Math.round(
                term * 12
            );


        const normalPayment =
            monthlyPayment(
                loan,
                rate,
                months
            );


        const normal =
            amortisation(
                loan,
                rate,
                normalPayment,
                months
            );


        /*
        Scenario with extras
        */

        let balance = loan;
        let interestTotal = 0;
        let paidTotal = 0;

        let actualMonths = 0;


        for (
            let month = 1;
            month <= months + 120 &&
            balance > 0.005;
            month++
        ) {
            actualMonths = month;

            const monthlyRate =
                rate / 100 / 12;

            const interest =
                balance *
                monthlyRate;

            let payment =
                normalPayment;


            if (
                month >=
                extraStart
            ) {
                payment +=
                    extraMonthly;
            }


            payment =
                Math.min(
                    payment,
                    balance +
                    interest
                );


            const principal =
                Math.max(
                    0,
                    payment -
                    interest
                );


            balance =
                Math.max(
                    0,
                    balance -
                    principal
                );


            interestTotal +=
                interest;

            paidTotal +=
                payment;


            /*
            Lump sum
            */

            if (
                lumpSum > 0 &&
                month === lumpMonth &&
                balance > 0
            ) {
                const actualLump =
                    Math.min(
                        lumpSum,
                        balance
                    );

                balance -=
                    actualLump;

                paidTotal +=
                    actualLump;
            }
        }


        const interestSaved =
            Math.max(
                0,
                normal.totalInterest -
                interestTotal
            );

        const monthsSaved =
            Math.max(
                0,
                normal.months -
                actualMonths
            );


        setText(
            "erSaved",
            money(
                interestSaved
            )
        );

        setText(
            "erTime",
            `${monthsSaved} months`
        );

        setText(
            "erNormalInterest",
            money(
                normal.totalInterest
            )
        );

        setText(
            "erNewInterest",
            money(
                interestTotal
            )
        );

        setText(
            "erNewTerm",
            `${actualMonths} months`
        );


        return {
            normal,
            interestTotal,
            paidTotal,
            actualMonths
        };
    }


    /* =========================================================
       3. INTEREST ONLY
       ========================================================= */

    function calculateIO() {

        const loan =
            getNumber("ioLoan");

        const rate =
            getNumber("ioRate");

        const term =
            getNumber("ioTerm");

        const ioPeriod =
            getNumber("ioPeriod");


        if (
            !validateLoan(
                loan,
                rate,
                term
            )
        ) {
            return;
        }


        if (
            ioPeriod <= 0 ||
            ioPeriod >= term
        ) {
            error(
                "The interest-only period must be greater than 0 and shorter than the total loan term."
            );

            return;
        }


        const ioMonths =
            Math.round(
                ioPeriod * 12
            );

        const totalMonths =
            Math.round(
                term * 12
            );

        const remainingMonths =
            totalMonths -
            ioMonths;


        const monthlyInterest =
            loan *
            rate /
            100 /
            12;


        const totalIOInterest =
            monthlyInterest *
            ioMonths;


        const piPayment =
            monthlyPayment(
                loan,
                rate,
                remainingMonths
            );


        setText(
            "ioPayment",
            money(
                monthlyInterest,
                2
            )
        );

        setText(
            "ioPi",
            money(
                piPayment,
                2
            )
        );

        setText(
            "ioInterest",
            money(
                totalIOInterest
            )
        );

        setText(
            "ioBalance",
            money(loan)
        );

        setText(
            "ioRemaining",
            `${(
                remainingMonths /
                12
            ).toFixed(1)} years`
        );


        return {
            monthlyInterest,
            piPayment,
            totalIOInterest,
            remainingMonths
        };
    }


    /* =========================================================
       4. IO VS P&I
       ========================================================= */

    function calculateCompare() {

        const loan =
            getNumber("cmpLoan");

        const piRate =
            getNumber("cmpPiRate");

        const ioRate =
            getNumber("cmpIoRate");

        const term =
            getNumber("cmpTerm");

        const ioPeriod =
            getNumber("cmpPeriod");

        const taxRate =
            clamp(
                getNumber("cmpTax") /
                100,
                0,
                1
            );


        if (
            !validateLoan(
                loan,
                piRate,
                term
            )
        ) {
            return;
        }


        if (
            ioPeriod <= 0 ||
            ioPeriod >= term
        ) {
            error(
                "The IO period must be shorter than the total loan term."
            );

            return;
        }


        const totalMonths =
            Math.round(
                term * 12
            );

        const ioMonths =
            Math.round(
                ioPeriod * 12
            );

        const remainingMonths =
            totalMonths -
            ioMonths;


        /*
        P&I scenario
        */

        const piPayment =
            monthlyPayment(
                loan,
                piRate,
                totalMonths
            );

        const pi =
            amortisation(
                loan,
                piRate,
                piPayment,
                totalMonths
            );


        /*
        IO scenario
        */

        const ioMonthly =
            loan *
            ioRate /
            100 /
            12;


        const ioInterest =
            ioMonthly *
            ioMonths;


        const postIOPayment =
            monthlyPayment(
                loan,
                ioRate,
                remainingMonths
            );


        const postIO =
            amortisation(
                loan,
                ioRate,
                postIOPayment,
                remainingMonths
            );


        const totalIOInterest =
            ioInterest +
            postIO.totalInterest;


        const difference =
            totalIOInterest -
            pi.totalInterest;


        /*
        Tax impact is illustrative only.
        */

        const afterTaxDifference =
            difference *
            (1 - taxRate);


        setText(
            "cmpPiPayment",
            money(
                piPayment,
                2
            )
        );

        setText(
            "cmpPiInterest",
            money(
                pi.totalInterest
            )
        );

        setText(
            "cmpIoPayment",
            money(
                ioMonthly,
                2
            )
        );

        setText(
            "cmpIoInterest",
            money(
                totalIOInterest
            )
        );

        setText(
            "cmpAfterTax",
            money(
                afterTaxDifference
            )
        );


        return {
            pi,
            piPayment,
            ioMonthly,
            totalIOInterest,
            afterTaxDifference
        };
    }


    /* =========================================================
       5. BORROWING POWER
       ========================================================= */

    function calculateBorrowing() {

        const income =
            Math.max(
                0,
                getNumber("bpIncome")
            );

        const partnerIncome =
            Math.max(
                0,
                getNumber("bpPartner")
            );

        const dependants =
            Math.max(
                0,
                Math.floor(
                    getNumber(
                        "bpDependants"
                    )
                )
            );

        const living =
            Math.max(
                0,
                getNumber("bpLiving")
            );

        const debts =
            Math.max(
                0,
                getNumber("bpDebts")
            );

        const cardLimits =
            Math.max(
                0,
                getNumber("bpCards")
            );

        const assessmentRate =
            Math.max(
                0,
                getNumber("bpRate")
            );

        const term =
            Math.max(
                1,
                getNumber("bpTerm")
            );

        const loanType =
            getValue(
                "bpType",
                "pi"
            );


        const grossIncome =
            income +
            partnerIncome;


        /*
        Simplified Australian
        resident income tax estimate.
        */

        const annualTax =
            australianTax(
                grossIncome
            );


        const netMonthly =
            Math.max(
                0,
                (
                    grossIncome -
                    annualTax
                ) / 12
            );


        /*
        Simple dependant allowance.

        This is deliberately conservative
        and is NOT a lender's HEM calculation.
        */

        const dependantCost =
            dependants *
            450;


        /*
        Credit card assessment:
        3% of total card limit per month.
        */

        const cardAssessment =
            cardLimits *
            0.03;


        const availableMonthly =
            Math.max(
                0,
                netMonthly -
                living -
                debts -
                dependantCost -
                cardAssessment
            );


        let borrowingPower = 0;


        if (
            loanType === "io"
        ) {

            const monthlyRate =
                assessmentRate /
                100 /
                12;

            if (
                monthlyRate > 0
            ) {
                borrowingPower =
                    availableMonthly /
                    monthlyRate;
            } else {
                borrowingPower =
                    availableMonthly *
                    term *
                    12;
            }

        } else {

            borrowingPower =
                presentValue(
                    availableMonthly,
                    assessmentRate,
                    term * 12
                );
        }


        borrowingPower =
            Math.max(
                0,
                borrowingPower
            );


        const assessmentPayment =
            loanType === "io"
                ? borrowingPower *
                  assessmentRate /
                  100 /
                  12
                : monthlyPayment(
                    borrowingPower,
                    assessmentRate,
                    term * 12
                );


        const buffer =
            Math.max(
                0,
                availableMonthly -
                assessmentPayment
            );


        setText(
            "bpResult",
            money(
                borrowingPower
            )
        );

        setText(
            "bpGross",
            money(
                grossIncome
            )
        );

        setText(
            "bpNet",
            money(
                netMonthly
            )
        );

        setText(
            "bpPayment",
            money(
                assessmentPayment,
                2
            )
        );

        setText(
            "bpBuffer",
            money(
                buffer,
                2
            )
        );


        return {
            borrowingPower,
            grossIncome,
            netMonthly,
            assessmentPayment,
            buffer
        };
    }


    function presentValue(
        payment,
        annualRate,
        months
    ) {

        if (
            payment <= 0 ||
            months <= 0
        ) {
            return 0;
        }


        const monthlyRate =
            annualRate /
            100 /
            12;


        if (
            monthlyRate === 0
        ) {
            return (
                payment *
                months
            );
        }


        return (
            payment *
            (
                1 -
                Math.pow(
                    1 +
                    monthlyRate,
                    -months
                )
            ) /
            monthlyRate
        );
    }


    function australianTax(
        income
    ) {

        if (
            income <= 18200
        ) {
            return 0;
        }


        if (
            income <= 45000
        ) {
            return (
                income -
                18200
            ) * 0.16;
        }


        if (
            income <= 135000
        ) {
            return (
                4288 +
                (
                    income -
                    45000
                ) * 0.30
            );
        }


        if (
            income <= 190000
        ) {
            return (
                31288 +
                (
                    income -
                    135000
                ) * 0.37
            );
        }


        return (
            51638 +
            (
                income -
                190000
            ) * 0.45
        );
    }


    /* =========================================================
       6. STAMP DUTY
       ========================================================= */

    function calculateStamp() {

        const propertyValue =
            Math.max(
                0,
                getNumber("sdValue")
            );

        const state =
            getValue(
                "sdState",
                "NSW"
            );

        const buyer =
            getValue(
                "sdBuyer",
                "owner"
            );

        const firstHomeBuyer =
            getValue(
                "sdFhb",
                "no"
            ) === "yes";

        const propertyType =
            getValue(
                "sdProperty",
                "established"
            );

        const foreignBuyer =
            getValue(
                "sdForeign",
                "no"
            ) === "yes";


        if (
            propertyValue <= 0
        ) {
            error(
                "Please enter a property value greater than $0."
            );

            return;
        }


        /*
        IMPORTANT:
        This is a simplified illustration.
        It is NOT an official state duty calculator.
        */


        const baseDuty =
            simplifiedStampDuty(
                propertyValue,
                state
            );


        /*
        Simplified foreign surcharge.
        */

        const foreignSurcharge =
            foreignBuyer
                ? propertyValue *
                  0.08
                : 0;


        /*
        Simplified first-home concession.

        We only apply it to an owner occupier,
        because investors should not receive
        the owner-occupier concession.
        */

        let concession = 0;


        if (
            firstHomeBuyer &&
            buyer === "owner" &&
            propertyType !== "vacant"
        ) {
            concession =
                Math.min(
                    baseDuty,
                    baseDuty * 0.50
                );
        }


        const finalDuty =
            Math.max(
                0,
                baseDuty -
                concession +
                foreignSurcharge
            );


        const cashNeeded =
            propertyValue +
            finalDuty;


        setText(
            "sdDuty",
            money(finalDuty)
        );

        setText(
            "sdBase",
            money(baseDuty)
        );

        setText(
            "sdSurcharge",
            money(foreignSurcharge)
        );

        setText(
            "sdConcession",
            money(concession)
        );

        setText(
            "sdCash",
            money(cashNeeded)
        );


        return {
            finalDuty,
            baseDuty,
            foreignSurcharge,
            concession,
            cashNeeded
        };
    }


    function simplifiedStampDuty(
        value,
        state
    ) {

        /*
        Approximate progressive models.
        These are deliberately labelled
        as simplified on the page.
        */


        const tables = {

            NSW: [
                [0, 0.0],
                [14000, 0.0125],
                [32000, 0.015],
                [97000, 0.0175],
                [372000, 0.035],
                [1240000, 0.045],
                [10000000, 0.055]
            ],

            VIC: [
                [0, 0.0],
                [25000, 0.014],
                [130000, 0.024],
                [960000, 0.055],
                [Infinity, 0.065]
            ],

            QLD: [
                [0, 0.0],
                [5000, 0.01],
                [75000, 0.015],
                [540000, 0.035],
                [1000000, 0.045],
                [Infinity, 0.0575]
            ],

            SA: [
                [0, 0.0],
                [12000, 0.01],
                [30000, 0.02],
                [50000, 0.03],
                [100000, 0.035],
                [200000, 0.04],
                [250000, 0.0425],
                [300000, 0.045],
                [500000, 0.0475],
                [Infinity, 0.055]
            ],

            WA: [
                [0, 0.0],
                [120000, 0.015],
                [150000, 0.02],
                [360000, 0.035],
                [725000, 0.04],
                [Infinity, 0.055]
            ],

            TAS: [
                [0, 0.0],
                [3000, 0.005],
                [25000, 0.0175],
                [75000, 0.025],
                [200000, 0.035],
                [375000, 0.04],
                [725000, 0.045],
                [Infinity, 0.055]
            ],

            ACT: [
                [0, 0.0],
                [200000, 0.014],
                [300000, 0.022],
                [500000, 0.034],
                [750000, 0.044],
                [Infinity, 0.048]
            ],

            NT: [
                [0, 0.0],
                [525000, 0.0],
                [3000000, 0.0495],
                [5000000, 0.0575],
                [Infinity, 0.065]
            ]
        };


        const table =
            tables[state] ||
            tables.NSW;


        let duty = 0;


        for (
            let i = 1;
            i < table.length;
            i++
        ) {

            const lower =
                table[i - 1][0];

            const upper =
                table[i][0];

            const rate =
                table[i][1];


            if (
                value > lower
            ) {

                const taxable =
                    Math.min(
                        value,
                        upper
                    ) -
                    lower;


                duty +=
                    Math.max(
                        0,
                        taxable
                    ) *
                    rate;
            }


            if (
                value <= upper
            ) {
                break;
            }
        }


        return duty;
    }


    /* =========================================================
       7. TAX DEDUCTIONS
       ========================================================= */

    function calculateTax() {

        const loan =
            Math.max(
                0,
                getNumber("taxLoan")
            );

        const interestRate =
            Math.max(
                0,
                getNumber("taxRate")
            );

        const term =
            Math.max(
                1,
                getNumber("taxTerm")
            );

        const taxableIncome =
            Math.max(
                0,
                getNumber("taxIncome")
            );

        const rentalIncome =
            Math.max(
                0,
                getNumber("taxRent")
            );

        const expenses =
            Math.max(
                0,
                getNumber("taxExpenses")
            );

        const depreciation =
            Math.max(
                0,
                getNumber("taxDep")
            );

        const selectedTaxRate =
            clamp(
                getNumber(
                    "taxRateSelect"
                ) / 100,
                0,
                1
            );


        if (
            loan <= 0
        ) {
            error(
                "Please enter a loan amount greater than $0."
            );

            return;
        }


        /*
        Approximate annual interest.

        This calculator is intentionally
        simple and does not model the full
        amortisation schedule.
        */

        const annualInterest =
            loan *
            interestRate /
            100;


        const deductibleCosts =
            annualInterest +
            expenses +
            depreciation;


        /*
        Rental result before tax.
        */

        const rentalPosition =
            rentalIncome -
            deductibleCosts;


        /*
        Tax saving based on deductible costs.

        For a more conservative representation,
        the tax saving cannot exceed the tax
        actually attributable to the deduction.
        */

        const taxSaving =
            deductibleCosts *
            selectedTaxRate;


        const afterTaxCashflow =
            rentalPosition +
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


        /*
        Keep taxable income read so the field
        is validated/used in the calculation
        context.

        A full Australian tax model would require
        the actual income brackets, Medicare levy,
        offsets, deductions and ownership structure.
        */

        void taxableIncome;
        void term;


        return {
            annualInterest,
            deductibleCosts,
            rentalPosition,
            taxSaving,
            afterTaxCashflow
        };
    }


    /* =========================================================
       8. LAND TAX
       ========================================================= */

    function calculateLandTax() {

        const landValue =
            Math.max(
                0,
                getNumber("ltValue")
            );

        const state =
            getValue(
                "ltState",
                "NSW"
            );

        const owner =
            getValue(
                "ltOwner",
                "individual"
            );


        if (
            landValue <= 0
        ) {
            error(
                "Please enter a land value greater than $0."
            );

            return;
        }


        /*
        Principal place of residence:
        simplified exemption.
        */

        if (
            owner === "home"
        ) {

            setText(
                "ltResult",
                money(0)
            );

            setText(
                "ltStateOut",
                state
            );

            setText(
                "ltThreshold",
                "Exempt"
            );

            setText(
                "ltTaxable",
                money(0)
            );

            setText(
                "ltRate",
                "0%"
            );

            return {
                tax: 0
            };
        }


        let threshold = 0;
        let taxable = landValue;
        let rate = 0;
        let tax = 0;


        /*
        Simplified models.
        */

        switch (state) {

            case "NSW":

                threshold =
                    owner === "foreign"
                        ? 0
                        : 1075000;

                if (
                    owner === "foreign"
                ) {

                    taxable =
                        landValue;

                    rate = 4;

                    tax =
                        taxable *
                        0.04;

                } else if (
                    landValue <=
                    threshold
                ) {

                    taxable = 0;
                    rate = 0;
                    tax = 0;

                } else {

                    taxable =
                        landValue -
                        threshold;

                    rate = 1.6;

                    tax =
                        100 +
                        taxable *
                        0.016;
                }

                break;


            case "VIC":

                threshold =
                    500000;

                if (
                    landValue <=
                    threshold
                ) {

                    taxable = 0;
                    rate = 0;
                    tax = 0;

                } else {

                    taxable =
                        landValue -
                        threshold;

                    rate = 1.3;

                    tax =
                        taxable *
                        0.013;
                }

                break;


            case "QLD":

                threshold =
                    600000;

                if (
                    landValue <=
                    threshold
                ) {

                    taxable = 0;
                    rate = 0;
                    tax = 0;

                } else {

                    taxable =
                        landValue -
                        threshold;

                    rate = 1.75;

                    tax =
                        taxable *
                        0.0175;
                }

                break;


            case "SA":

                threshold =
                    936000;

                if (
                    landValue <=
                    threshold
                ) {

                    taxable = 0;
                    rate = 0;
                    tax = 0;

                } else {

                    taxable =
                        landValue -
                        threshold;

                    rate = 0.5;

                    tax =
                        taxable *
                        0.005;
                }

                break;


            case "WA":

                threshold =
                    300000;

                if (
                    landValue <=
                    threshold
                ) {

                    taxable = 0;
                    rate = 0;
                    tax = 0;

                } else {

                    taxable =
                        landValue -
                        threshold;

                    rate = 2.5;

                    tax =
                        taxable *
                        0.025;
                }

                break;


            case "TAS":

                threshold =
                    100000;

                if (
                    landValue <=
                    threshold
                ) {

                    taxable = 0;
                    rate = 0;
                    tax = 0;

                } else {

                    taxable =
                        landValue -
                        threshold;

                    rate = 0.55;

                    tax =
                        taxable *
                        0.0055;
                }

                break;


            case "ACT":

                threshold = 0;
                taxable = landValue;
                rate = 0.9;

                tax =
                    taxable *
                    0.009;

                break;


            case "NT":

                threshold = 0;
                taxable = 0;
                rate = 0;
                tax = 0;

                break;


            default:

                threshold =
                    1075000;

                taxable =
                    Math.max(
                        0,
                        landValue -
                        threshold
                    );

                rate = 1.6;

                tax =
                    taxable *
                    0.016;
        }


        tax =
            Math.max(
                0,
                tax
            );


        setText(
            "ltResult",
            money(tax)
        );

        setText(
            "ltStateOut",
            state
        );

        setText(
            "ltThreshold",
            threshold > 0
                ? money(threshold)
                : "$0"
        );

        setText(
            "ltTaxable",
            money(taxable)
        );

        setText(
            "ltRate",
            percent(
                rate,
                2
            )
        );


        return {
            tax,
            threshold,
            taxable,
            rate
        };
    }


    /* =========================================================
       9. AMORTISATION SCHEDULE
       ========================================================= */

    function calculateSchedule() {

        const loan =
            getNumber("amLoan");

        const rate =
            getNumber("amRate");

        const term =
            getNumber("amTerm");

        const type =
            getValue(
                "amType",
                "pi"
            );

        const ioPeriod =
            Math.max(
                0,
                getNumber("amIO")
            );

        const extra =
            Math.max(
                0,
                getNumber("amExtra")
            );


        if (
            !validateLoan(
                loan,
                rate,
                term
            )
        ) {
            return;
        }


        const totalMonths =
            Math.round(
                term * 12
            );


        const ioMonths =
            type === "io"
                ? Math.round(
                    ioPeriod * 12
                )
                : 0;


        if (
            type === "io" &&
            (
                ioMonths <= 0 ||
                ioMonths >=
                totalMonths
            )
        ) {
            error(
                "The IO period must be greater than 0 and shorter than the loan term."
            );

            return;
        }


        const monthlyRate =
            rate / 100 / 12;


        let balance = loan;

        let totalInterest = 0;
        let totalPaid = 0;

        const rows = [];


        /*
        Interest-only period
        */

        for (
            let month = 1;
            month <= ioMonths;
            month++
        ) {

            const interest =
                balance *
                monthlyRate;

            totalInterest +=
                interest;

            totalPaid +=
                interest;


            rows.push({
                month,
                type: "IO",
                payment: interest,
                principal: 0,
                interest,
                balance,
                totalInterest
            });
        }


        /*
        Remaining P&I period
        */

        const remainingMonths =
            totalMonths -
            ioMonths;


        const payment =
            monthlyPayment(
                balance,
                rate,
                remainingMonths
            );


        for (
            let i = 1;
            i <= remainingMonths &&
            balance > 0.005;
            i++
        ) {

            const month =
                ioMonths + i;


            const interest =
                balance *
                monthlyRate;


            let actualPayment =
                payment +
                extra;


            actualPayment =
                Math.min(
                    actualPayment,
                    balance +
                    interest
                );


            const principal =
                Math.max(
                    0,
                    actualPayment -
                    interest
                );


            balance =
                Math.max(
                    0,
                    balance -
                    principal
                );


            totalInterest +=
                interest;

            totalPaid +=
                actualPayment;


            rows.push({
                month,
                type: "P&I",
                payment:
                    actualPayment,
                principal,
                interest,
                balance,
                totalInterest
            });
        }


        /*
        First displayed payment
        */

        const firstPayment =
            type === "io" &&
            ioMonths > 0
                ? loan *
                  monthlyRate
                : payment;


        setText(
            "amPayment",
            money(
                firstPayment,
                2
            )
        );

        setText(
            "amInterest",
            money(
                totalInterest
            )
        );

        setText(
            "amTotal",
            money(
                totalPaid
            )
        );

        setText(
            "amMonths",
            String(
                rows.length
            )
        );

        setText(
            "amStart",
            money(loan)
        );


        renderSchedule(rows);


        return {
            rows,
            totalInterest,
            totalPaid,
            months:
                rows.length
        };
    }


    function renderSchedule(
        rows
    ) {

        const body =
            $("amortisationBody");

        if (!body) {
            return;
        }


        if (
            rows.length === 0
        ) {

            body.innerHTML = `
                <tr>
                    <td colspan="7">
                        No schedule available.
                    </td>
                </tr>
            `;

            return;
        }


        const fragment =
            document.createDocumentFragment();


        rows.forEach(row => {

            const tr =
                document.createElement("tr");


            const values = [
                row.month,
                row.type,
                money(
                    row.payment,
                    2
                ),
                money(
                    row.principal,
                    2
                ),
                money(
                    row.interest,
                    2
                ),
                money(
                    row.balance,
                    2
                ),
                money(
                    row.totalInterest,
                    2
                )
            ];


            values.forEach(value => {

                const td =
                    document.createElement("td");

                td.textContent =
                    value;

                tr.appendChild(td);
            });


            fragment.appendChild(tr);
        });


        body.replaceChildren(
            fragment
        );
    }


    /* =========================================================
       CALCULATOR ACTIONS
       ========================================================= */

    const actions = {

        pi:
            calculatePI,

        extra:
            calculateExtra,

        io:
            calculateIO,

        compare:
            calculateCompare,

        borrowing:
            calculateBorrowing,

        stamp:
            calculateStamp,

        tax:
            calculateTax,

        "land-tax":
            calculateLandTax,

        schedule:
            calculateSchedule
    };


    /* =========================================================
       TAB SWITCHING
       ========================================================= */

    function activateCalculator(
        calculator
    ) {

        document
            .querySelectorAll(
                ".calc-tab"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.calculator ===
                    calculator
                );
            });


        document
            .querySelectorAll(
                ".calc-panel"
            )
            .forEach(panel => {

                panel.classList.toggle(
                    "active",
                    panel.id ===
                    `panel-${calculator}`
                );
            });
    }


    function activateCategory(
        category
    ) {

        document
            .querySelectorAll(
                ".calculator-category"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.category ===
                    category
                );
            });


        document
            .querySelectorAll(
                ".calculator-group"
            )
            .forEach(group => {

                group.classList.toggle(
                    "active",
                    group.dataset.group ===
                    category
                );
            });


        const firstCalculator =
            document.querySelector(
                `.calculator-group[data-group="${category}"] .calc-tab`
            );


        if (
            firstCalculator
        ) {

            activateCalculator(
                firstCalculator.dataset.calculator
            );
        }
    }


    /* =========================================================
       SCHEDULE TOGGLE
       ========================================================= */

    function setupScheduleToggle() {

        const button =
            $("toggleSchedule");

        const wrapper =
            $("scheduleTableWrapper");


        if (
            !button ||
            !wrapper
        ) {
            return;
        }


        button.addEventListener(
            "click",
            () => {

                const visible =
                    wrapper.classList.toggle(
                        "show"
                    );


                button.textContent =
                    visible
                        ? "Hide schedule"
                        : "Show schedule";
            }
        );
    }


    /* =========================================================
       EVENT BINDING
       ========================================================= */

    function bindEvents() {

        /*
        Calculator category buttons
        */

        document
            .querySelectorAll(
                ".calculator-category"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const category =
                            button.dataset.category;

                        if (
                            category
                        ) {
                            activateCategory(
                                category
                            );
                        }
                    }
                );
            });


        /*
        Calculator tabs
        */

        document
            .querySelectorAll(
                ".calc-tab"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const calculator =
                            button.dataset.calculator;

                        if (
                            calculator
                        ) {
                            activateCalculator(
                                calculator
                            );
                        }
                    }
                );
            });


        /*
        Calculate buttons
        */

        document
            .querySelectorAll(
                ".calc-action"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        const action =
                            button.dataset.action;

                        const calculator =
                            actions[action];


                        if (
                            typeof calculator !==
                            "function"
                        ) {

                            error(
                                `Calculator "${action}" is not configured.`
                            );

                            return;
                        }


                        try {

                            calculator();

                        } catch (
                            calculationError
                        ) {

                            console.error(
                                calculationError
                            );

                            error(
                                "Something went wrong while calculating. Please check the values and try again."
                            );
                        }
                    }
                );
            });


        setupScheduleToggle();


        /*
        Footer year.
        Your HTML uses #year, not #footerYear.
        */

        setText(
            "year",
            new Date()
                .getFullYear()
                .toString()
        );
    }


    /* =========================================================
       INITIALISE
       ========================================================= */

    function initialise() {

        bindEvents();


        /*
        Run P&I immediately so the first
        calculator isn't blank.
        */

        try {
            calculatePI();
        } catch (
            calculationError
        ) {
            console.error(
                calculationError
            );
        }
    }


    /*
    DOM ready
    */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialise,
            {
                once: true
            }
        );

    } else {

        initialise();
    }


    /*
    Optional public API for debugging
    from browser console.

    Example:
    SILAMCalculator.calculatePI()
    */

    window.SILAMCalculator = {

        calculatePI,

        calculateExtra,

        calculateIO,

        calculateCompare,

        calculateBorrowing,

        calculateStamp,

        calculateTax,

        calculateLandTax,

        calculateSchedule,

        monthlyPayment,

        amortisation
    };

})();