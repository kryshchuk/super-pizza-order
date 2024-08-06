import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { combineLatest, Observable, startWith } from 'rxjs';
import { map } from 'rxjs/operators';

interface Topping {
  toppings: string;
  price: number;
}
interface PriceData { [key: string]: number; }

interface ColumnData {control: string; value: number;}

interface OrderData {
  total: (ColumnData | null)[],
  itemsNumber: number;
}

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatCheckboxModule,
    MatTableModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './order.component.html',
  styleUrl: './order.component.scss'
})
export class OrderComponent implements OnInit {
  orderForm: FormGroup;
  itemsNumber!: {[key: string]:Observable<number>};
  offerSmallObs!: Observable<number>;
  offerMediumObs!: Observable<number>;
  offerLargeObs!: Observable<number>;
  offerExtraLargeObs!: Observable<number>;
  sizeColumns = ['small', 'medium', 'large', 'extraLarge']
  displayedColumns: string[] = ['toppings', ...this.sizeColumns];
  dataSource: Topping[] = [
    { toppings: 'Tomatoes ($1.00)', price: 1.00 },
    { toppings: 'Onions ($0.50)', price: 0.50 },
    { toppings: 'Bell pepper ($1.00)', price: 1.00 },
    { toppings: 'Mushrooms ($1.20)', price: 1.20 },
    { toppings: 'Pineapple ($0.75)', price: 0.75 },
    { toppings: 'Sausage ($1.00)', price: 1.00 },
    { toppings: 'Pepperoni ($2.00)', price: 2.00 },
    { toppings: 'Barbecue chicken ($3.00)', price: 3.00 }
  ];

  offers = {
    offerOne: 5,
    offerTwo: 9,
    offerThree: 0.5
  }

  prices: PriceData = this.sizeColumns.reduce((ac, val) => {
    return {...ac, ...this.dataSource.reduce((a, v) => ({...a, [v.toppings + val]:v.price}), {})}
  }, {});
  basePrices = {
    small: 5, 
    medium: 7, 
    large: 8, 
    extraLarge: 9
  };

  constructor(private fb: FormBuilder) {
    this.orderForm = this.fb.group({});

  }

  ngOnInit(): void {    
    this.dataSource.forEach((topping, index) => {
      this.sizeColumns.forEach(size => {
        this.orderForm.addControl(`${topping.toppings}${size}`, this.fb.control(false));
        if (index === 0) {
          this.orderForm.addControl(`items${size}`, this.fb.control(0));
        }
      })
    });
    this.itemsNumber = this.getItemsNumberObs(this.sizeColumns);
    this.initOfferValue();    
  }


  initOfferValue() {
    this.offerSmallObs = combineLatest(
    [
      this.getTotalObs(this.dataSource, 'small').pipe(
        map((val)=> {
          const toppingsPrice = val.map(item => item?.value ?? 0).reduce((v, i) => (v + i), 0);
          return toppingsPrice > 0 ? toppingsPrice + this.basePrices.small : this.basePrices.small;
        }),
        startWith(0)
      ),
      this.itemsNumber['itemssmall']
    ]).pipe(
      map(this.offerFinalPrice)
    );
    
    this.offerMediumObs = combineLatest([
      this.getTotalObs(this.dataSource, 'medium'),
      this.itemsNumber['itemsmedium']]
    ).pipe(
      map(([total, itemsNumber]) => ({total, itemsNumber})),
      map(this.offerOne),
      map(this.offerTwo),
      map((item) => {
        if (!(item instanceof Object)) return item;
        const price = item.total.filter(item => item !== null);
        return this.sumCalculationFn(this.basePrices.medium)(price) * item.itemsNumber;
      }),
      startWith(0)
    );
    this.offerLargeObs = combineLatest(
      [this.getTotalObs(this.dataSource, 'large').pipe(
        map(this.offerThree),
        map((item) => {
          if (!Array.isArray(item)) return item;
          const price = item.filter(item => item !== null);
          return this.sumCalculationFn(this.basePrices.large)(price);
        }),
        startWith(0)
      ),
      this.itemsNumber['itemslarge']]
    ).pipe(
      map(this.offerFinalPrice)
    );
    this.offerExtraLargeObs = combineLatest(
      [
        this.getTotalObs(this.dataSource, 'extraLarge').pipe(
          map((val)=> val.map(item => item?.value ?? 0).reduce((v, i) => (v + i))),
          startWith(0)
        ),
        this.itemsNumber['itemsextraLarge']
      ]).pipe(
        map(this.offerFinalPrice)
      );
  }

  offerOne = (val: OrderData | number) => {
    if (!(val instanceof Object)) return val;
    return val.total.filter((x) => (x?.value ?? 0) >0).length === 2 ? this.offers.offerOne * val.itemsNumber : val;
  }
  offerTwo = (val: OrderData | number) => {
    if (!(val instanceof Object)) return val;

    const offerItemsNumber = Math.trunc(val.itemsNumber/2);
    const itemsOutOfOffer = val.itemsNumber%2;
    
    const isOfferActive = offerItemsNumber > 0 && val.total.filter((x) => (x?.value ?? 0)>0).length === 4;
    
    const priceOutOfOffer = itemsOutOfOffer > 0 ? this.sumCalculationFn(this.basePrices.medium)(val.total) : 0;

    return isOfferActive ? this.offers.offerTwo*offerItemsNumber + priceOutOfOffer : val;
  }

  offerThree = (val: (ColumnData | null)[] | number) => {
    if (!Array.isArray(val)) return val;
    const toppingsOffer = ['Barbecue chicken ($3.00)','Pepperoni ($2.00)'];
    const selectedToppings: (ColumnData | null)[] = [];
    let sum = this.basePrices.large;
    let doublePointsToppings = val.filter((x) => {
      const price = x?.value ?? 0;
      if (price > 0) {
        selectedToppings.push(x); sum = sum + price;
      }      
      return toppingsOffer.includes(x?.control ?? '') && price > 0;
    });
    
    const isOfferApproved = (doublePointsToppings.length === 2 && selectedToppings.length === 2) ||
    (doublePointsToppings.length === 1 && selectedToppings.length === 3) || (selectedToppings.length === 4 && doublePointsToppings.length === 0);

    return isOfferApproved ? sum * this.offers.offerThree : val;
  }

  sumCalculationFn = (basePrice: number) => (val: (ColumnData | number | null)[])=> {
    const toppingsPrice = val.map(item => ( item instanceof Object) ? item['value'] : (item ?? 0)).reduce((v, i) => (v + (i ?? 0)), 0);
    return toppingsPrice > 0 ? toppingsPrice + basePrice : basePrice;
  }

  getTotalObs(dataSource: Topping[], size: string):Observable<(ColumnData | null)[]>  {
    return combineLatest(dataSource.map(topping => {
      return this.orderForm.controls[`${topping.toppings}${size}`].valueChanges.pipe(
        map((val) => {
          const res = val ? this.prices[`${topping.toppings}${size}`] : 0;
          return {control: `${topping.toppings}`, value: res}
      }),
      startWith(null)
    )
    }))
  }

  getItemsNumberObs(sizeColumns: string[])  {
    let inputsObs: {[key: string]:Observable<number>} = {};
    sizeColumns.forEach(size => {
      inputsObs[`items${size}`] = this.orderForm.controls[`items${size}`].valueChanges.pipe(
        startWith(0)
      )
    });
    return inputsObs;
  }

  offerFinalPrice([itemPrice, itemsNumber]: [number, number]) {
    return itemPrice*itemsNumber
  }

}
