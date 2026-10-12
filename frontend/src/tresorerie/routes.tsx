import type{ RouteObject } from 'react-router-dom';
import { ResourcePage } from '../components/ResourcePage';
import { compteDescripteur } from './config/compte';
import { categorieMouvementDescripteur } from './config/categorieMouvement';
import { mouvementDescripteur } from './config/mouvement';
import { imputationEncaissementDescripteur } from './config/imputationEncaissement';
import { encaissementDescripteur } from './config/encaissement';
import { virementDescripteur } from './config/virement';
import { depenseDescripteur } from './config/depense';
import { arreteCaisseDescripteur } from './config/arreteCaisse';
import { billetageDescripteur } from './config/billetage';
import { TableauBord } from './components/TableauBord';
import { EncaissementForm } from './components/EncaissementForm';
import { VirementForm } from './components/VirementForm';
import { DepenseForm } from './components/DepenseForm';
import { ArreteCaisseForm } from './components/ArreteCaisseForm';
import { BilletageForm } from './components/BilletageForm';

export const routesTresorerie: RouteObject[] = [
  {
    path: 'tresorerie',
    children: [
      { index: true, element: <TableauBord /> },

      { path: 'comptes', element: <ResourcePage descripteur={compteDescripteur} /> },
      { path: 'categories-mouvement', element: <ResourcePage descripteur={categorieMouvementDescripteur} /> },
      { path: 'mouvements', element: <ResourcePage descripteur={mouvementDescripteur} /> },
      { path: 'imputations-encaissement', element: <ResourcePage descripteur={imputationEncaissementDescripteur} /> },

      {
        path: 'encaissements',
        children: [
          { index: true, element: <ResourcePage descripteur={encaissementDescripteur} /> },
          { path: 'nouveau', element: <EncaissementForm /> },
          { path: ':id', element: <EncaissementForm /> },
        ],
      },
      {
        path: 'virements',
        children: [
          { index: true, element: <ResourcePage descripteur={virementDescripteur} /> },
          { path: 'nouveau', element: <VirementForm /> },
          { path: ':id', element: <VirementForm /> },
        ],
      },
      {
        path: 'depenses',
        children: [
          { index: true, element: <ResourcePage descripteur={depenseDescripteur} /> },
          { path: 'nouveau', element: <DepenseForm /> },
          { path: ':id', element: <DepenseForm /> },
        ],
      },
      {
        path: 'arretes-caisse',
        children: [
          { index: true, element: <ResourcePage descripteur={arreteCaisseDescripteur} /> },
          { path: 'nouveau', element: <ArreteCaisseForm /> },
          { path: ':id', element: <ArreteCaisseForm /> },
        ],
      },
      {
        path: 'billetage',
        children: [
          { index: true, element: <ResourcePage descripteur={billetageDescripteur} /> },
          { path: 'nouveau', element: <BilletageForm /> },
          { path: ':id', element: <BilletageForm /> },
        ],
      },
      {
        path: 'arretes-caisse/:arreteId/billetage',
        element: <BilletageForm />,
      },
    ],
  },
];