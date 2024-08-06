import { Routes } from '@angular/router';
import { OrderComponent } from './order/order.component';

export const routes: Routes = [
    // {path: '', pathMatch: 'full', component: LoginComponent},
    {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
        import('./order/order.component').then((m) => m.OrderComponent),
    }
];
