import { DOCUMENT, NumberSymbol, getLocaleNumberSymbol } from '@angular/common';
import { Directive, ElementRef, EventEmitter, HostListener, Inject, Input, LOCALE_ID, Output, SimpleChanges } from '@angular/core';

/**
 * 1. Add FixedDecimal within the declarations section in app.module.ts
 * 2. <input matInput [(model)]="localDecimalValue" fixedDecimal>
 */
@Directive({
    selector: '[fixedDecimal]'
})
export class FixedDecimal {

    // =====================================================================================================
    //      MODEL ATTRIBUTE
    // =====================================================================================================

    @Input() model!: number;
    @Output() modelChange = new EventEmitter<number>();

    // =====================================================================================================
    //      OPTIONAL INPUT PARAMETERS
    // =====================================================================================================

    @Input() fractionDigits: number = 2; // positive integer, must be greater than 0
    @Input() separator: string = ','; // either Comma or Period character
    @Input() min: number = 0; // positive or negative decimal, must be less than max
    @Input() max: number = 1; // more than min and less than 999 to avoid thousands separator issues
    @Input() step: number = 0.1; // decimal divisible by 10, greater than zero
    @Input() microStep: number = 0.01; // decimal divisible by 10, greater than zero, less than step
    @Input() arrowColor: string = "lightgray";
    @Input() arrowHoverColor: string = "grey";

    // =====================================================================================================
    //      PRIVATE VARIABLES
    // =====================================================================================================

    private el: any;
    private arrowSpinner!: HTMLElement;
    private localeSeparator!: string;
    private placeholder: string = "0,00";
    private validSeparatorRegExp: RegExp = new RegExp(/^[\.,\,]{1}$/g);
    private singleDigitRegExp: RegExp = new RegExp(/^\d{1}$/g);
    private permittedKeys: Array<string> = [
        'End',
        'Home',
        'ArrowLeft',
        'ArrowRight',
        'Tab'
    ];

    // =====================================================================================================
    //      INIT METHODS
    // =====================================================================================================

    constructor(
        private elementRef: ElementRef,
        @Inject(DOCUMENT) private document: Document,
        @Inject(LOCALE_ID) public locale: string
    ) {
        this.el = this.elementRef.nativeElement;
        this.localeSeparator = getLocaleNumberSymbol(locale, NumberSymbol.Decimal);
    }

    ngAfterViewInit() {
        this.el.type = 'text';
        this.placeholder = this.numberToString(1).replace('1', '0');
        this.validateInputParams();
        // setup parent mouse handlers
        this.el.parentNode.parentNode.parentNode.addEventListener("mousedown", this.disableParentEvents);
        this.el.parentNode.parentNode.parentNode.addEventListener("mouseenter", this.disableParentEvents);
        this.el.parentNode.parentNode.parentNode.addEventListener("mousewheel", this.onMouseWheel.bind(this));
    }

    // =====================================================================================================
    //      ANGULAR EVENT HANDLERS
    // =====================================================================================================

    // create arrow spinner DOM element so it can be added or removed later
    ngOnInit() {
        this.initArrowSpinner();
    }

    // make changes visible whenever the internal number model is changed
    ngOnChanges(changes: SimpleChanges) {
        if (changes['model']) {
            this.el.value = this.numberToString(changes['model'].currentValue);
        }
    }

    // =====================================================================================================
    //      DIRECTIVE EVENT HANDLERS
    // =====================================================================================================

    // fire when value is changed by event handlers that run outside the directive
    // such as the mouse event listeners for mousewheel and button click events
    @HostListener('change', ['$event'])
    onChange(event: any) {
        this.valueChanged();
    }

    // make changes propagate back to parent component whenever the value is changed
    valueChanged() {
        if (this.el.value) {
            this.model = this.stringToNumber(this.el.value);
        } else {
            this.model = 0;
        }
        this.modelChange.emit(this.model);
    }

    // =====================================================================================================
    //      KEYBOARD EVENT HANDLERS
    // =====================================================================================================

    @HostListener('keydown.ArrowUp', ['$event'])
    onArrowUpKey(event: KeyboardEvent) {
        this.onUpArrowMouseDown(event);
        event.preventDefault();
    }

    @HostListener('keydown.ArrowDown', ['$event'])
    onArrowDownKey(event: KeyboardEvent) {
        this.onDownArrowMouseDown(event);
        event.preventDefault();
    }

    @HostListener('keydown.shift.ArrowUp', ['$event'])
    onShiftArrowUpKey(event: KeyboardEvent) {
        this.onUpArrowMouseDown(event);
        event.preventDefault();
    }

    @HostListener('keydown.shift.ArrowDown', ['$event'])
    onShiftArrowDownKey(event: KeyboardEvent) {
        this.onDownArrowMouseDown(event);
        event.preventDefault();
    }

    @HostListener('keydown.enter', ['$event'])
    onEnterKey(event: KeyboardEvent) {
        console.debug("KeyDown: " + event.key);
        this.el.selectionStart = this.el.value.length;
        if (this.el.value == this.placeholder) {
            this.el.value = '';
            this.valueChanged();
        }
        this.el.blur();
        event.preventDefault();
    }

    @HostListener('paste', ['$event'])
    onPaste(event: KeyboardEvent) {
        console.debug("Paste disabled");
        event.preventDefault();
    }

    @HostListener('keydown.delete', ['$event'])
    onDeleteKey(event: KeyboardEvent) {
        console.debug("KeyDown: " + event.key);
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionStart == this.el.selectionEnd) {
            if (this.el.selectionStart < decimalPointPosition) {
                this.onIntegerDeleteWithoutSelection(event);
                event.preventDefault();
                return;
            }
            if (this.el.selectionStart >= decimalPointPosition) {
                this.onFractionDeleteWithoutSelection(event);
                event.preventDefault();
                return;
            }
        }
        if (this.el.selectionStart != this.el.selectionEnd) {
            if (this.el.selectionStart < decimalPointPosition && this.el.selectionEnd <= decimalPointPosition + 1) {
                this.onIntegerDeleteWithSelection(event);
                event.preventDefault();
                return;
            }
            if (this.el.selectionStart >= decimalPointPosition) {
                this.onFractionDeleteWithSelection(event);
                event.preventDefault();
                return;
            }
        }
        if (this.el.selectionStart == 0 && this.el.selectionEnd == this.el.value.length) {
            this.onDeleteAll(event);
            event.preventDefault();
            return;
        }
    }

    @HostListener('keydown.backspace', ['$event'])
    onBackspaceKey(event: KeyboardEvent) {
        console.debug("KeyDown: " + event.key);
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionStart == this.el.selectionEnd) {
            if (this.el.selectionStart <= decimalPointPosition && this.el.selectionStart > 0) {
                this.onIntegerBackspaceWithoutSelection(event);
                event.preventDefault();
                return;
            }
            if (this.el.selectionStart >= decimalPointPosition + 1) {
                this.onFractionBackspaceWithoutSelection(event);
                event.preventDefault();
                return;
            }
        }
        if (this.el.selectionStart != this.el.selectionEnd) {
            if (this.el.selectionStart <= decimalPointPosition && this.el.selectionEnd <= decimalPointPosition + 1) {
                this.onIntegerBackspaceWithSelection(event);
                event.preventDefault();
                return;
            }
            if (this.el.selectionStart >= decimalPointPosition) {
                this.onFractionBackspaceWithSelection(event);
                event.preventDefault();
                return;
            }
        }
        if (this.el.selectionStart == 0 && this.el.selectionEnd == this.el.value.length) {
            this.onDeleteAll(event);
            event.preventDefault();
            return;
        }
    }

    @HostListener('keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        // --------------------- permit copy paste keys --------------
        if (event.ctrlKey && event.key == 'c') {
            console.debug("KeyDown: Ctrl-C");
            return;
        }
        if (event.ctrlKey && event.key == 'v') {
            console.debug("KeyDown: Ctrl-V");
            event.preventDefault(); // do not allow paste
            return;
        }
        // --------------------- permit navigation keys --------------
        if (this.permittedKeys.indexOf(event.key) !== -1) {
            console.debug("KeyDown: " + event.key);
            return;
        }
        // --------------------- process digit keys ------------------
        if (String(event.key).match(this.singleDigitRegExp)) {
            console.debug("KeyDown: " + event.key);
            let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
            if (this.el.value == '') {
                this.onDigitWhileEmpty(event);
                event.preventDefault();
                return;
            }
            if (this.el.value == this.placeholder && this.el.selectionStart == this.el.selectionEnd) {
                if (this.el.selectionStart <= decimalPointPosition) {
                    this.onIntegerDigitWhileZeroWithoutSelection(event);
                    event.preventDefault();
                    return;
                } else {
                    this.onFractionDigitWhileZeroWithoutSelection(event);
                    event.preventDefault();
                    return;
                }
            }
            if (this.el.value == this.placeholder && this.el.selectionStart != this.el.selectionEnd) {
                if (this.el.selectionStart < decimalPointPosition && this.el.selectionEnd <= decimalPointPosition + 1) {
                    this.onIntegerDigitWhileZeroWithSelection(event);
                    event.preventDefault();
                    return;
                }
                if (this.el.selectionStart >= decimalPointPosition) {
                    this.onFractionDigitWhileZeroWithSelection(event);
                    event.preventDefault();
                    return;
                }
                if (this.el.selectionStart == 0 && this.el.selectionEnd == this.el.value.length) {
                    this.onOverwriteAll(event);
                    event.preventDefault();
                    return;
                }
            }
            if (this.el.selectionStart == this.el.selectionEnd) {
                if (this.el.selectionStart <= decimalPointPosition) {
                    this.onIntegerDigitWithoutSelection(event);
                    event.preventDefault();
                    return;
                } else {
                    this.onFractionDigitWithoutSelection(event);
                    event.preventDefault();
                    return;
                }
            }
            if (this.el.selectionStart != this.el.selectionEnd) {
                if (this.el.selectionStart < decimalPointPosition && this.el.selectionEnd <= decimalPointPosition + 1) {
                    this.onIntegerDigitWithSelection(event);
                    event.preventDefault();
                    return;
                }
                if (this.el.selectionStart >= decimalPointPosition) {
                    this.onFractionDigitWithSelection(event);
                    event.preventDefault();
                    return;
                }
                if (this.el.selectionStart == 0 && this.el.selectionEnd == this.el.value.length) {
                    this.onOverwriteAll(event);
                    event.preventDefault();
                    return;
                }
            }
        }
        // ------------- process decimal separator keys --------------
        if (String(event.key).match(this.validSeparatorRegExp)) {
            console.debug("KeyDown: " + event.key);
            let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
            if (this.el.value == '') {
                this.onDecimalSeparatorWhileEmpty(event);
                event.preventDefault();
                return;
            }
            if (this.el.selectionStart == decimalPointPosition) {
                this.onDecimalSeparator(event);
                event.preventDefault();
                return;
            }
            if (this.el.selectionEnd == decimalPointPosition) {
                this.onDecimalSeparator(event);
                event.preventDefault();
                return;
            }
            if (this.el.selectionStart == 0 && this.el.selectionEnd == this.el.value.length) {
                this.onDecimalSeparator(event);
                event.preventDefault();
                return;
            }
        }
        // ------------------ disable all other keys -----------------
        event.preventDefault();
    }

    onDigitWhileEmpty(event: KeyboardEvent) {
        console.debug('KeyDown: Digit while empty');
        let digitVal = new Number(event.key).valueOf();
        if (digitVal == 0) {
            this.el.value = this.placeholder;
            this.valueChanged();
            this.el.selectionStart = 1;
            this.el.selectionEnd = 1;
        }
        if (digitVal && digitVal <= this.max && digitVal >= this.min) {
            this.el.value = this.numberToString(digitVal);
            this.valueChanged();
            this.el.selectionStart = 1;
            this.el.selectionEnd = 1;
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onIntegerDigitWhileZeroWithoutSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Integer digit while zero without selection');
        let position = this.el.selectionStart;
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        let nextStrVal = [
            this.el.value.slice(0, this.el.selectionStart),
            event.key,
            this.el.value.slice(this.el.selectionStart)
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            if (position = decimalPointPosition) {
                // at decimal point position so stay there, do not go into fractions
                this.el.selectionStart = position;
                this.el.selectionEnd = position;
            } else {
                this.el.selectionStart = position + 1;
                this.el.selectionEnd = position + 1;
            }
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onIntegerDigitWhileZeroWithSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Integer digit while zero with selection');
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        this.el.selectionStart = decimalPointPosition;
        this.onIntegerDigitWhileZeroWithoutSelection(event);
    }

    onFractionDigitWhileZeroWithSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Fraction digit while zero with selection');
        let position = this.el.selectionStart;
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (position == decimalPointPosition) {
            position++;
        }
        let nextStrVal = [
            this.el.value.slice(0, position),
            event.key
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            if (nextVal) {
                this.el.value = this.numberToString(nextVal);
                this.valueChanged();
                this.el.selectionStart = position + 1;
            } else {
                this.el.selectionStart = position + 1;
                this.el.selectionEnd = position + 2;
            }
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onFractionDigitWhileZeroWithoutSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Fraction digit while zero without selection');
        let position = this.el.selectionStart;
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (position == decimalPointPosition) {
            position++;
        }
        let nextStrVal = [
            this.el.value.slice(0, position),
            event.key
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            this.el.selectionStart = position + 1;
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onIntegerDigitWithoutSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Integer digit without selection');
        let oldStrValue = this.el.value;
        let position = this.el.selectionStart;
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        let nextStrVal = [
            this.el.value.slice(0, this.el.selectionStart),
            event.key,
            this.el.value.slice(this.el.selectionStart)
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            // let maxIntegerDigits = this.numberToString(this.max).indexOf(this.separator);
            if (position == 1 && decimalPointPosition == 1 && oldStrValue[0] == '0') {
                this.el.selectionStart = position;
                this.el.selectionEnd = position;
            } else {
                this.el.selectionStart = position + 1;
                this.el.selectionEnd = position + 1;
            }
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onFractionDigitWithoutSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Fraction digit without selection');
        console.warn('Doing nothing on fraction digits without a selection');
    }

    onIntegerDigitWithSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Integer digit with selection');
        let position = this.el.selectionStart;
        let endPosition = this.el.selectionEnd;
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionEnd == decimalPointPosition + 1) {
            this.el.selectionEnd = decimalPointPosition;
        }
        let nextStrVal = [
            this.el.value.slice(0, this.el.selectionStart),
            event.key,
            this.el.value.slice(this.el.selectionEnd)
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            this.el.selectionStart = position + 1;
            if (endPosition == decimalPointPosition) {
                this.el.selectionEnd = position + 1;
            } else {
                this.el.selectionEnd = position + 2;
            }
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onFractionDigitWithSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Fraction digit with selection');
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionStart == decimalPointPosition) {
            this.el.selectionStart = decimalPointPosition + 1;
        }
        let position = this.el.selectionStart;
        let zeroPadding = this.el.selectionEnd - this.el.selectionStart - 1;
        let nextStrVal = [
            this.el.value.slice(0, this.el.selectionStart),
            event.key,
            new Array(zeroPadding + 1).join('0'),
            this.el.value.slice(this.el.selectionStart + 1 + zeroPadding)
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            this.el.selectionStart = position + 1;
            this.el.selectionEnd = position + 2;
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onOverwriteAll(event: KeyboardEvent) {
        console.debug('KeyDown: Overwrite all');
        let digitVal = new Number(event.key).valueOf();
        if (digitVal == 0) {
            this.el.value = this.placeholder;
            this.valueChanged();
            this.el.selectionStart = 1;
            this.el.selectionEnd = 1;
        }
        if (digitVal && digitVal <= this.max && digitVal >= this.min) {
            this.el.value = this.numberToString(digitVal);
            this.valueChanged();
            this.el.selectionStart = 1;
            this.el.selectionEnd = 1;
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onDeleteAll(event: KeyboardEvent) {
        this.el.value = '';
        this.valueChanged();
    }

    onDecimalSeparatorWhileEmpty(event: KeyboardEvent) {
        console.debug('KeyDown: Decimal separator while empty');
        this.el.value = this.placeholder;
        this.valueChanged();
        this.el.selectionStart = 2;
    }

    onDecimalSeparator(event: KeyboardEvent) {
        console.debug('KeyDown: Decimal separator');
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        this.el.selectionStart = decimalPointPosition + 1;
        this.el.selectionEnd = decimalPointPosition + 2;
    }

    onIntegerDeleteWithoutSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Integer delete without selection');
        let position = this.el.selectionStart;
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        let nextStrVal = [
            this.el.value.slice(0, this.el.selectionStart),
            this.el.value.slice(this.el.selectionStart + 1)
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            if (position == 0 && decimalPointPosition == 1) {
                this.el.selectionStart = position + 1;
                this.el.selectionEnd = position + 1;
            } else {
                this.el.selectionStart = position;
                this.el.selectionEnd = position;
            }
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onFractionDeleteWithoutSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Fraction delete without selection');
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionStart == decimalPointPosition) {
            this.el.selectionStart = decimalPointPosition + 1;
        }
        let position = this.el.selectionStart;
        this.el.selectionEnd = this.el.selectionStart + 1;
        let nextStrVal = [
            this.el.value.slice(0, this.el.selectionStart),
            '0',
            this.el.value.slice(this.el.selectionStart + 1)
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            this.el.selectionStart = position;
            this.el.selectionEnd = position + 1;
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onIntegerDeleteWithSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Integer delete with selection');
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionStart == decimalPointPosition) {
            this.el.selectionStart = decimalPointPosition + 1;
        }
        let position = this.el.selectionStart;
        let zeroPadding = this.el.selectionEnd - this.el.selectionStart - 1;
        let nextStrVal = this.el.value;
        if (this.el.value.slice(position, position + 1) == '0' && zeroPadding == 0 && position + 1 != decimalPointPosition) {
            console.debug("Digit already zero, advancing to next one");
            this.el.selectionStart = this.el.selectionStart + 1;
            this.el.selectionEnd = this.el.selectionEnd + 1;
            position = this.el.selectionStart;
            nextStrVal = [
                this.el.value.slice(0, this.el.selectionStart),
                '0',
                this.el.value.slice(this.el.selectionStart + 1 + zeroPadding)
            ].join('');
        } else {
            nextStrVal = [
                this.el.value.slice(0, this.el.selectionStart),
                '0',
                new Array(zeroPadding + 1).join('0'),
                this.el.value.slice(this.el.selectionStart + 1 + zeroPadding)
            ].join('');
        }
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            this.el.selectionStart = position;
            this.el.selectionEnd = position + 1;
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onFractionDeleteWithSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Fraction delete with selection');
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionStart == decimalPointPosition) {
            this.el.selectionStart = decimalPointPosition + 1;
        }
        let position = this.el.selectionStart;
        let zeroPadding = this.el.selectionEnd - this.el.selectionStart - 1;
        let nextStrVal = this.el.value;
        if (this.el.value.slice(position, position + 1) == '0' && zeroPadding == 0) {
            console.debug("Digit already zero, advancing to next one");
            this.el.selectionStart = this.el.selectionStart + 1;
            this.el.selectionEnd = this.el.selectionEnd + 1;
            position = this.el.selectionStart;
            nextStrVal = [
                this.el.value.slice(0, this.el.selectionStart),
                '0',
                this.el.value.slice(this.el.selectionStart + 1 + zeroPadding)
            ].join('');
        } else {
            nextStrVal = [
                this.el.value.slice(0, this.el.selectionStart),
                '0',
                new Array(zeroPadding + 1).join('0'),
                this.el.value.slice(this.el.selectionStart + 1 + zeroPadding)
            ].join('');
        }
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            this.el.selectionStart = position;
            this.el.selectionEnd = position + 1;
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onIntegerBackspaceWithoutSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Integer backspace without selection');
        let position = this.el.selectionStart - 1;
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        let nextStrVal = [
            this.el.value.slice(0, this.el.selectionStart - 1),
            this.el.value.slice(this.el.selectionStart)
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            if (position == 0 && decimalPointPosition == 1) {
                this.el.selectionStart = position + 1;
                this.el.selectionEnd = position + 1;
            } else {
                this.el.selectionStart = position;
                this.el.selectionEnd = position;
            }
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onFractionBackspaceWithoutSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Fraction backspace without selection');
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionStart == decimalPointPosition + 1) {
            this.el.selectionStart = decimalPointPosition;
        }
        let position = this.el.selectionStart - 1;
        this.el.selectionEnd = this.el.selectionStart;
        let nextStrVal = [
            this.el.value.slice(0, this.el.selectionStart - 1),
            '0',
            this.el.value.slice(this.el.selectionStart)
        ].join('');
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            this.el.selectionStart = position;
            this.el.selectionEnd = position + 1;
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onIntegerBackspaceWithSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Integer backspace with selection');
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionStart == decimalPointPosition) {
            this.el.selectionStart = decimalPointPosition - 1;
            this.el.selectionEnd = decimalPointPosition;
        }
        let position = this.el.selectionStart;
        let zeroPadding = this.el.selectionEnd - this.el.selectionStart - 1;
        let nextStrVal = this.el.value;
        if (this.el.value.slice(position, position + 1) == '0' && zeroPadding == 0 && position > 0) {
            console.debug("Digit already zero, backing up to previous one");
            this.el.selectionStart = this.el.selectionStart - 1;
            this.el.selectionEnd = this.el.selectionEnd - 1;
            position = this.el.selectionStart;
            nextStrVal = [
                this.el.value.slice(0, this.el.selectionStart),
                '0',
                this.el.value.slice(this.el.selectionStart + 1 + zeroPadding)
            ].join('');
        } else {
            nextStrVal = [
                this.el.value.slice(0, this.el.selectionStart),
                '0',
                new Array(zeroPadding + 1).join('0'),
                this.el.value.slice(this.el.selectionStart + 1 + zeroPadding)
            ].join('');
        }
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            this.el.selectionStart = position - 1;
            this.el.selectionEnd = position;
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    onFractionBackspaceWithSelection(event: KeyboardEvent) {
        console.debug('KeyDown: Fraction backspace with selection');
        let decimalPointPosition = this.el.value.length - this.fractionDigits - 1;
        if (this.el.selectionStart == decimalPointPosition) {
            this.el.selectionStart = decimalPointPosition + 1;
        }
        let position = this.el.selectionStart;
        let zeroPadding = this.el.selectionEnd - this.el.selectionStart - 1;
        let nextStrVal = this.el.value;
        if (this.el.value.slice(position, position + 1) == '0' && zeroPadding == 0) {
            console.debug("Digit already zero, backing up to previous one");
            if (position - 1 == decimalPointPosition) {
                this.el.selectionStart = this.el.selectionStart - 1;
                this.el.selectionEnd = this.el.selectionEnd - 1;
                position = this.el.selectionStart;
            }
            nextStrVal = [
                this.el.value.slice(0, this.el.selectionStart - 1),
                '0',
                this.el.value.slice(this.el.selectionStart + zeroPadding)
            ].join('');
        } else {
            nextStrVal = [
                this.el.value.slice(0, this.el.selectionStart),
                '0',
                new Array(zeroPadding + 1).join('0'),
                this.el.value.slice(this.el.selectionStart + 1 + zeroPadding)
            ].join('');
        }
        let nextVal = this.stringToNumber(nextStrVal);
        if (nextVal >= this.min && nextVal <= this.max) {
            this.el.value = this.numberToString(nextVal);
            this.valueChanged();
            if (position - 1 == decimalPointPosition) {
                this.el.selectionStart = position - 2;
                this.el.selectionEnd = position - 1;
            } else {
                this.el.selectionStart = position - 1;
                this.el.selectionEnd = position;
            }
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
    }

    // =====================================================================================================
    //      FOCUS EVENT HANDLERS
    // =====================================================================================================

    @HostListener('focus', ['$event'])
    onFocus(event: any) {
        if (!event.srcElement.disabled) {
            this.el.placeholder = this.placeholder;
            this.el.selectionStart = 0;
            this.el.selectionEnd = this.el.value.length;
            this.el.parentNode.parentNode.appendChild(this.arrowSpinner);
        }
    }

    @HostListener('blur', ['$event'])
    onBlur(event: any) {
        if (!event.srcElement.disabled) {
            this.el.placeholder = '';
            this.el.parentNode.parentNode.removeChild(this.arrowSpinner);
            if (this.el.value == this.placeholder) {
                this.el.value = '';
                this.valueChanged();
            }
        }
    }

    // =====================================================================================================
    //      MOUSE EVENT HANDLERS
    // =====================================================================================================

    @HostListener('mouseenter', ['$event'])
    onMouseEnter(event: any) {
        // if (!event.srcElement.disabled) {
        //     this.el.focus();
        // }
    }

    @HostListener('mousewheel', ['$event'])
    onMouseWheel(event: any) {
        if (this.el === this.document.activeElement) {
            if (event.wheelDelta > 0) {
                this.onUpArrowMouseDown(event);
            }
            if (event.wheelDelta < 0) {
                this.onDownArrowMouseDown(event);
            }
        }
        event.preventDefault();
    }

    @HostListener('dragstart', ['$event'])
    onDragStart(event: any) {
        event.preventDefault();
    }

    @HostListener('dragenter', ['$event'])
    onDragEnter(event: any) {
        event.preventDefault();
    }

    @HostListener('dragover', ['$event'])
    onDragOver(event: any) {
        event.preventDefault();
    }

    @HostListener('drop', ['$event'])
    onDrop(event: any) {
        event.preventDefault();
    }

    // =====================================================================================================
    //      JAVASCRIPT EVENT HANDLERS
    // =====================================================================================================

    disableParentEvents(event: any) {
        if (event.srcElement.nodeName != "INPUT") {
            event.preventDefault();
        }
        // bring first child INPUT element into focus
        // if (event.srcElement.getElementsByTagName("INPUT").length > 0) {
        //     if (!event.srcElement.getElementsByTagName("INPUT")[0].disabled) {
        //         event.srcElement.getElementsByTagName("INPUT")[0].focus();
        //     }
        // }
    }

    onArrowMouseEnter(event: any) {
        event.srcElement.setAttribute("style", "cursor:pointer;font-size:12px;color:" + this.arrowHoverColor);
        event.preventDefault();
    }

    onArrowMouseOut(event: any) {
        event.srcElement.setAttribute("style", "cursor:pointer;font-size:12px;color:" + this.arrowColor);
        event.preventDefault();
    }

    onArrowMouseUp(event: any) {
        event.srcElement.setAttribute("style", "cursor:pointer;font-size:12px;color:" + this.arrowHoverColor);
        event.preventDefault();
    }

    onUpArrowMouseDown(event: any) {
        if (event.srcElement.nodeName == "TD") {
            // reduce font size to create press effect only if src element is a spinner arrow
            event.srcElement.setAttribute("style", "cursor:pointer;font-size:10px;color:" + this.arrowHoverColor);
        }
        let numVal = this.stringToNumber(this.el.value);
        if (numVal < this.max) {
            if (event.shiftKey) {
                // adding (microStep/20) before calculating the floor prevents race conditions 
                let floorVal = this.floor(numVal + this.microStep / 20, this.decimalToFractionDigits(this.microStep));
                if (floorVal + this.microStep <= this.max) {
                    numVal = floorVal + this.microStep;
                } else {
                    numVal = this.max;
                }
            } else {
                // adding (step/20) before calculating the floor prevents race conditions 
                let floorVal = this.floor(numVal + this.step / 20, this.decimalToFractionDigits(this.step));
                if (floorVal + this.step <= this.max) {
                    numVal = floorVal + this.step;
                } else {
                    numVal = this.max;
                }
            }
            numVal = this.round(numVal, this.fractionDigits);
            this.el.value = this.numberToString(numVal);
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
        this.el.dispatchEvent(new Event("change"));
        event.preventDefault();
    }

    onDownArrowMouseDown(event: any) {
        if (event.srcElement.nodeName == "TD") {
            // reduce font size to create press effect only if src element is a spinner arrow
            event.srcElement.setAttribute("style", "cursor:pointer;font-size:10px;color:" + this.arrowHoverColor);
        }
        let numVal = this.stringToNumber(this.el.value);
        if (numVal > this.min) {
            let oldVal = numVal;
            if (event.shiftKey) {
                let floorVal = this.floor(numVal, this.decimalToFractionDigits(this.microStep));
                if (floorVal >= this.min + this.microStep) {
                    numVal = floorVal;
                }
                if (oldVal == numVal && numVal >= this.min + this.microStep) {
                    numVal -= this.microStep;
                }
            } else {
                let floorVal = this.floor(numVal, this.decimalToFractionDigits(this.step));
                if (floorVal >= this.min + this.step) {
                    numVal = floorVal;
                }
                if (oldVal == numVal && numVal >= this.min + this.step) {
                    numVal -= this.step;
                }
            }
            numVal = this.round(numVal, this.fractionDigits);
            this.el.value = this.numberToString(numVal);
        } else {
            // console.warn("Outside limits: " + this.min + " - " + this.max);
        }
        this.el.dispatchEvent(new Event("change"));
        event.preventDefault();
    }

    // =====================================================================================================
    //      UTILITY FUNCTIONS
    // =====================================================================================================

    numberToString(numVal: number): string {
        if (numVal) {
            let numStr = numVal.toLocaleString(this.locale, {
                maximumFractionDigits: this.fractionDigits,
                minimumFractionDigits: this.fractionDigits
            });
            return numStr.replace(this.localeSeparator, this.separator);
        }
        return '';
    }

    stringToNumber(strVal: string): number {
        if (strVal) {
            return new Number(strVal.replace(this.separator, this.localeSeparator)).valueOf();
        }
        return 0;
    }

    decimalToFractionDigits(numVal: number): number {
        return Math.log10(1 / numVal);
    }

    round(numVal: number, digits: number): number {
        let precision = Math.pow(10, digits);
        return Math.round((numVal + Number.EPSILON) * precision) / precision;
    }

    floor(numVal: number, digits: number): number {
        let precision = Math.pow(10, digits);
        let floorVal = Math.floor((numVal + Number.EPSILON) * precision) / precision;
        return floorVal;
    }

    // =====================================================================================================
    //      UTILITY METHODS
    // =====================================================================================================

    validateInputParams() {
        if (!Number.isInteger(this.fractionDigits)) {
            console.warn("fractionDigits: must be a positive integer greater than 0");
            this.fractionDigits = 2;
            console.info("Resetting fractionDigits to " + this.fractionDigits);
        }
        if (this.fractionDigits < 1) {
            console.warn("fractionDigits: must be greater than 0");
            this.fractionDigits = 2;
            console.info("Resetting fractionDigits to " + this.fractionDigits);
        }
        if (!String(this.separator).match(this.validSeparatorRegExp)) {
            console.warn("separator: must be either a Comma or a Period");
            this.separator = ',';
            console.info("Resetting separator to " + this.separator);
        }
        if (this.step <= 0) {
            console.warn("step: must be greater than zero");
            this.step = 0.1;
            console.info("Resetting step to " + this.step);
        }
        if (this.step % 10 === 0) {
            console.warn("step: must be divisible by 10. i.e. 0.1, 0.01 etc...");
            this.step = 0.1;
            console.info("Resetting step to " + this.step);
        }
        if (this.min >= this.max) {
            console.warn("min: must be less than max: " + this.max);
            this.min = this.round(this.max - (this.step * 10), this.fractionDigits);
            console.info("Resetting min to " + this.min);
        }
        if (this.max <= this.min) {
            console.warn("max: must be greater than min: " + this.min);
            this.max = this.round(this.min + (this.step * 10), this.fractionDigits);
            console.info("Resetting max to " + this.max);
        }
        if (Math.abs(this.max) > 999) {
            console.warn("max: must be less than 999");
            this.max = 999;
            console.info("Resetting max to " + this.max);
        }
        if (this.microStep <= 0) {
            console.warn("microStep: must be greater than zero");
            this.microStep = 0.01;
            console.info("Resetting step to " + this.microStep);
        }
        if (this.microStep % 10 === 0) {
            console.warn("step: must be divisible by 10. i.e. 0.1, 0.01 etc...");
            this.microStep = 0.01;
            console.info("Resetting step to " + this.microStep);
        }
        if (this.microStep >= this.step) {
            console.warn("microStep: must be less than step: " + this.step);
            this.microStep = this.round(this.step / 10, this.fractionDigits);
            console.info("Resetting microStep to " + this.microStep);
        }
    }

    initArrowSpinner() {
        let upperCell = this.document.createElement("td")
        upperCell.setAttribute("style", "cursor:pointer;font-size:12px;color:" + this.arrowColor);
        upperCell.innerHTML = "&#x25B2;";
        upperCell.addEventListener("mousedown", this.onUpArrowMouseDown.bind(this));
        upperCell.addEventListener("mouseup", this.onArrowMouseUp.bind(this));
        upperCell.addEventListener("mouseenter", this.onArrowMouseEnter.bind(this));
        upperCell.addEventListener("mouseout", this.onArrowMouseOut.bind(this));
        let lowerCell = this.document.createElement("td")
        lowerCell.setAttribute("style", "cursor:pointer;font-size:12px;color:" + this.arrowColor);
        lowerCell.innerHTML = "&#x25BC;";
        lowerCell.addEventListener("mousedown", this.onDownArrowMouseDown.bind(this));
        lowerCell.addEventListener("mouseup", this.onArrowMouseUp.bind(this));
        lowerCell.addEventListener("mouseenter", this.onArrowMouseEnter.bind(this));
        lowerCell.addEventListener("mouseout", this.onArrowMouseOut.bind(this));
        let upperRow = this.document.createElement("tr");
        upperRow.appendChild(upperCell);
        let lowerRow = this.document.createElement("tr");
        lowerRow.appendChild(lowerCell);
        this.arrowSpinner = this.document.createElement("table");
        this.arrowSpinner.setAttribute("style", "border-spacing:0px;align-self:center;line-height:14px;text-align:center;");
        this.arrowSpinner.appendChild(upperRow);
        this.arrowSpinner.appendChild(lowerRow);
    }

}