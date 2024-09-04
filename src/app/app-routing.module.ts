import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DatePickerComponent } from './date-picker/date-picker.component';
import { MainComponent } from './main/main.component';

const routes: Routes = [
  {path: 'main', component:MainComponent },
  {path: 'date-picker', component:DatePickerComponent },
  {path: '',   redirectTo: '/main', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false })],
  exports: [RouterModule]
})
export class AppRoutingModule { }

