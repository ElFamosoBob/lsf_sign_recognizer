# lsf_sign_recognizer

## Qu'est-ce que c'est ?

Un site web qui détecte quelques signes de la Langues des Signes Françaises grâce à votre webcam. Purement statique (pas de serveurs, tout les images restent sur votre pc).

## D'où ça sort ?

Ce projet est tiré d'un site web que j'ai fait, disponible sur mon github, LumIA. Une des énigmes était de signer certaines lettres, détectées par la caméra. J'ai essayé d'expérimenter avec ça, et c'est ce projet. C'est pas un code qui est bien fait ou quoi que ce soit, c'est juste au stade de prototype pour l'instant. Je pense que de toutes façons le format web limite un peu les performances.

## Comment ça marche ?

Pour ce qui est de comment ça marche : une librairie de reconnaissance de mains et faciale, Mediapipe, pose dès qu'elle détecte des points sur les mains / le visage. On peut customiser le nombre de main détectés mais plus il y en a plus les performances sont mauvaises. Aussi chaque image que Mediapipe traite est compressée en 192*192 donc il vaut mieux faire les signes proches de la caméra sinon la compression fait que la détection ne marche pas bien. 

Magnifique main avec les fameux points : 
![Main avec les poitns mis par Mediapipe](./gand_mediapipie.png)

Ensuite on interprète la position des ces points pour détecter certains signes : si par exemple tous les doigts sont repliés sauf le pouce et que l'orientation et vers le haut, on interprète le geste "super".

Note : la librairie est inclus dans le projet (elle est un peu volumineuse d'ailleurs), le site est vraiment purement statique.

## Comment le lancer

Si guthub pages est toujours en ligne (pas garanti) : ```https://elfamosobob.github.io/lsf_sign_recognizer/```

Soit vous téléchargez le projet et vous tapez dans le repo sur linux : 
```python -m http.server 4000```

Et ensuite dans votre naviguateur allez à l'adresse : http://localhost:4000

Si vous êtes sur windows... vous n'avez pas honte ? Il faudra aussi lancer un serveur python mais je ne sais guère comment faire.😁
