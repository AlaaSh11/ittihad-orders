// UNCONFIRMED: Three conflicting sets of branch names found across source files:
//   - index.html:   المعمل, فرع 1, فرع 2, توصيل ديليفري, توصيل فان براد
//   - 200.html:     فرع -1- البيسين, فرع -2- بشارة الخوري, المعمل, Delivery / ديليفري
//   - Master prompt: فرع 1, فرع 2, توصيل بيروت, توصيل خارج بيروت
// Using index.html values as default. Verify canonical branch names with shop before deployment.

export const DELIVERY_OPTIONS = [
  'المعمل',
  'فرع 1',
  'فرع 2',
  'توصيل ديليفري',
  'توصيل فان براد',
  'أخرى',
];
